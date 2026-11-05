"""Streaming helpers for CAI API.

Implements Server-Sent Events (SSE) for high-level reasoning steps:
- No token-level streaming.
- Emits events for tools, tool outputs, messages, handoffs, and agent switches.
- Sends a final summary event with accumulated reasoning steps and final output.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Dict, List, Tuple

from cai.sdk.agents.items import (
    HandoffOutputItem,
    ItemHelpers,
    MessageOutputItem,
    ToolCallItem,
    ToolCallOutputItem,
)
from cai.sdk.agents.result import RunResult, RunResultStreaming
from cai.sdk.agents.stream_events import (
    AgentUpdatedStreamEvent,
    RawResponsesStreamEvent,
    RunItemStreamEvent,
    StreamEvent,
)
from cai.sdk.agents.lifecycle import RunHooks
from cai.sdk.agents.run import Runner, DEFAULT_MAX_TURNS
from cai.sdk.agents.exceptions import MaxTurnsExceeded


def _sse(event: str, data: Dict[str, Any]) -> bytes:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


def _step_from_run_item_event(evt: RunItemStreamEvent) -> Dict[str, Any] | None:
    name = evt.name
    item = evt.item
    # Message produced by the assistant (full message, not token deltas)
    if isinstance(item, MessageOutputItem):
        text = ItemHelpers.text_message_output(item)
        return {
            "type": "message",
            "agent": getattr(item.agent, "name", None),
            "text": text,
        }
    # Tool call request
    if isinstance(item, ToolCallItem):
        raw = item.raw_item
        tool_name = getattr(raw, "name", None) or getattr(raw, "type", None)
        args = getattr(raw, "arguments", None)
        return {
            "type": "tool_call",
            "agent": getattr(item.agent, "name", None),
            "tool": tool_name,
            "arguments": args,
        }
    # Tool call output
    if isinstance(item, ToolCallOutputItem):
        return {
            "type": "tool_output",
            "agent": getattr(item.agent, "name", None),
            "output": item.output,
        }
    # Handoff
    if isinstance(item, HandoffOutputItem):
        return {
            "type": "handoff",
            "from_agent": getattr(item.source_agent, "name", None),
            "to_agent": getattr(item.target_agent, "name", None),
        }
    # Reasoning or other
    return {
        "type": name,
        "agent": getattr(item.agent, "name", None),
    }


async def sse_stream_for_run(result: RunResultStreaming) -> AsyncIterator[bytes]:
    """Yield SSE events as the run progresses and a final summary at completion."""
    steps: List[Dict[str, Any]] = []
    last_message: str | None = None

    # Avoid contextvar reset issues when Starlette closes the stream in a different task context
    # (RunResultStreaming.stream_events() will try to finish the trace). We disable trace finishing
    # here by clearing the internal trace reference. Tracing for API streaming can be handled
    # at a higher level if needed.
    try:
        result._trace = None  # type: ignore[attr-defined]
    except Exception:
        pass

    try:
        async for evt in result.stream_events():
            # Skip raw token-level events entirely
            if isinstance(evt, RawResponsesStreamEvent):
                continue

            if isinstance(evt, RunItemStreamEvent):
                step = _step_from_run_item_event(evt)
                if step:
                    steps.append(step)
                    if step.get("type") == "message":
                        last_message = step.get("text")
                    yield _sse("reasoning_step", step)
                continue

            if isinstance(evt, AgentUpdatedStreamEvent):
                step = {"type": "agent_switched", "agent": getattr(evt.new_agent, "name", None)}
                steps.append(step)
                yield _sse("reasoning_step", step)
                continue
    except Exception as e:  # Ensure the SSE never explodes the response
        yield _sse("error", {"message": str(e)})

    # When complete, emit a final summary event
    # Derive a text_output from all message output items observed (no tokens)
    text_output = last_message
    final_output = result.final_output
    if hasattr(final_output, "model_dump"):
        final_output = final_output.model_dump(exclude_unset=True)
    summary = {
        "steps": steps,
        "final_message": text_output,
        "final_output": final_output,
    }
    yield _sse("final", summary)


class _SSEHooks(RunHooks[Any]):
    def __init__(self, q: asyncio.Queue, autonomy_ctrl: Any = None):
        self.q = q
        self.autonomy_ctrl = autonomy_ctrl
        self.tools_in_cycle = 0

    def reset_cycle_counter(self) -> None:
        self.tools_in_cycle = 0

    async def on_agent_start(self, context, agent):  # type: ignore[override]
        await self.q.put({"type": "agent_switched", "agent": getattr(agent, "name", None)})

    async def on_handoff(self, context, from_agent, to_agent):  # type: ignore[override]
        await self.q.put({
            "type": "handoff",
            "from_agent": getattr(from_agent, "name", None),
            "to_agent": getattr(to_agent, "name", None),
        })

    async def on_tool_start(self, context, agent, tool):  # type: ignore[override]
        self.tools_in_cycle += 1
        tool_name = getattr(tool, "name", None) or "tool"
        args = getattr(tool, "_last_args", None)
        if self.autonomy_ctrl is not None:
            try:
                self.autonomy_ctrl.observe_tool_call(tool_name, args)
            except Exception:
                pass
        await self.q.put({
            "type": "tool_call",
            "agent": getattr(agent, "name", None),
            "tool": tool_name,
            "arguments": args,
        })

    async def on_tool_end(self, context, agent, tool, result):  # type: ignore[override]
        tool_name = getattr(tool, "name", None) or "tool"
        if self.autonomy_ctrl is not None:
            try:
                self.autonomy_ctrl.observe_tool_output(tool_name, result)
            except Exception:
                pass
        await self.q.put({
            "type": "tool_output",
            "agent": getattr(agent, "name", None),
            "output": result,
        })


async def sse_stream_via_hooks(starting_agent, input_items, *, context=None, max_turns: int | float | None = None, session: Any | None = None) -> AsyncIterator[bytes]:
    """SSE stream built on top of non-streaming model runs, using RunHooks + Autonomy Loop.

    - Executes the 5-stage cognitive loop: Perceive -> Plan -> Act -> Observe -> Reflect -> Replan.
    - Prevents premature termination when the LLM outputs a plan without calling tools.
    - Yields real-time reasoning_step, autonomy_checkpoint, and final SSE events.
    """
    import os
    from cai.autonomy import AutonomyController, AutonomyState
    from cai.audit import audit_logger

    session_id = getattr(session, "id", "") if session is not None else "default"
    target = ""
    autonomy_enabled = os.getenv("CAI_AUTONOMY_LOOP", "true").lower() not in ("0", "false", "no")

    if isinstance(context, dict):
        target = str(context.get("target") or context.get("scope") or "")
        if "autonomy" in context and context["autonomy"] is not None:
            autonomy_enabled = bool(context["autonomy"])
    if session is not None:
        meta = getattr(session, "metadata", None) or {}
        if isinstance(meta, dict):
            if not target:
                target = str(meta.get("target") or "")
            if "autonomy" in meta and meta["autonomy"] is not None and (not isinstance(context, dict) or "autonomy" not in context):
                autonomy_enabled = bool(meta["autonomy"])

    # Extract initial user prompt string
    initial_prompt = ""
    if isinstance(input_items, str):
        initial_prompt = input_items
    elif isinstance(input_items, list) and input_items:
        last_item = input_items[-1]
        if isinstance(last_item, dict):
            initial_prompt = str(last_item.get("content") or "")

    total_max_turns = int(max_turns) if isinstance(max_turns, (int, float)) else 30
    max_cycles = min(8, max(2, total_max_turns // 3))

    autonomy_state = AutonomyState(
        session_id=session_id or "default",
        target=target,
        initial_prompt=initial_prompt,
        max_turns=total_max_turns,
        max_cycles=max_cycles,
    )
    autonomy_ctrl = AutonomyController(autonomy_state)

    queue: asyncio.Queue = asyncio.Queue()
    hooks = _SSEHooks(queue, autonomy_ctrl=autonomy_ctrl)
    steps: list[dict] = []
    last_message: str | None = None
    final_result_holder: list[RunResult] = []

    async def _run_autonomy_loop() -> RunResult:
        nonlocal last_message
        current_agent = starting_agent
        current_input = (
            list(input_items)
            if isinstance(input_items, list)
            else [{"role": "user", "content": str(input_items)}]
        )
        # Inject prior SQLite Campaign Memory if available for this target (Phase 3)
        try:
            from cai.memory import campaign_memory

            if target or autonomy_ctrl.is_actionable_pentest_intent(initial_prompt, target):
                mem_ctx = campaign_memory.build_context_for_target(target)
                if mem_ctx and current_input and isinstance(current_input[-1], dict):
                    orig_content = str(current_input[-1].get("content") or "")
                    if "TRÍ NHỚ CHIẾN DỊCH DÀI HẠN" not in orig_content:
                        current_input[-1] = {
                            **current_input[-1],
                            "content": f"{orig_content}\n\n{mem_ctx}",
                        }
        except Exception:
            pass
        last_res: RunResult | None = None

        while True:
            autonomy_ctrl.state.cycle += 1
            hooks.reset_cycle_counter()
            rem_turns = max(1, total_max_turns - autonomy_ctrl.state.turns_used)
            if rem_turns <= 0 or autonomy_ctrl.state.cycle > autonomy_ctrl.state.max_cycles:
                break

            cycle_turns = min(5, rem_turns) if autonomy_enabled else rem_turns

            try:
                last_res = await Runner.run(
                    current_agent,
                    current_input,
                    context=context,
                    max_turns=cycle_turns,
                    hooks=hooks,
                )
            except MaxTurnsExceeded:
                last_res = RunResult(
                    input=current_input,
                    new_items=[],
                    raw_responses=[],
                    final_output=None,
                    _last_agent=current_agent,
                    input_guardrail_results=[],
                    output_guardrail_results=[],
                )

            # Extract assistant message from this cycle
            cycle_msg: str | None = None
            for it in last_res.new_items:
                if isinstance(it, MessageOutputItem):
                    txt = ItemHelpers.text_message_output(it)
                    if txt:
                        cycle_msg = txt
                        last_message = txt

            if cycle_msg:
                msg_step = {
                    "type": "message",
                    "agent": getattr(last_res.last_agent, "name", None),
                    "text": cycle_msg,
                }
                await queue.put(msg_step)
                try:
                    audit_logger.log_llm_turn(session_id, cycle_msg)
                except Exception:
                    pass

            try:
                current_input = last_res.to_input_list()
            except Exception:
                pass
            current_agent = last_res.last_agent

            if not autonomy_enabled:
                break

            should_continue, next_prompt, cp = autonomy_ctrl.evaluate_and_reflect(
                cycle_msg or "", hooks.tools_in_cycle
            )
            await queue.put(cp)
            try:
                audit_logger.log_event(session_id, "autonomy_checkpoint", cp)
            except Exception:
                pass

            if not should_continue or not next_prompt:
                break

            current_input.append({"role": "user", "content": next_prompt})

        # Persist conversation history directly onto session
        if session is not None:
            try:
                session.history = current_input
            except Exception:
                pass

        assert last_res is not None
        final_result_holder.append(last_res)
        return last_res

    task = asyncio.create_task(_run_autonomy_loop())
    if session is not None:
        try:
            session.set_running_task(task)
        except Exception:
            pass

    try:
        while True:
            if task.done() and queue.empty():
                break
            try:
                item = await asyncio.wait_for(queue.get(), timeout=0.2)
            except asyncio.TimeoutError:
                continue
            steps.append(item)
            yield _sse("reasoning_step", item)
    finally:
        result: RunResult | None = None
        try:
            result = await task
        except asyncio.CancelledError:
            if final_result_holder:
                result = final_result_holder[-1]
        except Exception as e:
            yield _sse("error", {"message": str(e)})

        if session is not None:
            try:
                session.set_running_task(None)
            except Exception:
                pass

        final_output = getattr(result, "final_output", None) if result is not None else None
        if hasattr(final_output, "model_dump"):
            final_output = final_output.model_dump(exclude_unset=True)

        # Persist steps into session for later UX summaries
        if session is not None:
            try:
                session.last_steps = steps
            except Exception:
                pass
        yield _sse("final", {"steps": steps, "final_message": last_message, "final_output": final_output})


def _token_event_from_raw(raw_evt: Any) -> Dict[str, Any] | None:
    """Translate a raw Responses stream event to a token-level SSE dict.

    We focus on message boundaries and text deltas. Event objects have a 'type' string.
    """
    etype = getattr(raw_evt, "type", None)
    if not etype:
        return None
    # Message boundaries
    if etype == "response.output_item.added":
        return {"type": "message_start"}
    if etype == "response.output_item.done":
        return {"type": "message_end"}
    # Text deltas
    if etype == "response.output_text.delta":
        text = getattr(raw_evt, "delta", None)
        if text:
            return {"type": "token_delta", "text": text}
    return None


async def sse_stream_tokens_for_run(result: RunResultStreaming, session: Any | None = None) -> AsyncIterator[bytes]:
    """Yield SSE with token-level events plus high-level steps.

    - Emits token_delta/message_start/message_end from raw model events.
    - Also emits reasoning_step events for tools/handoffs/messages/agent switches.
    - Finishes with a final event including last_message and final_output.
    """
    steps: List[Dict[str, Any]] = []
    last_message: str | None = None

    # Avoid contextvar reset mismatch on stream completion
    try:
        result._trace = None  # type: ignore[attr-defined]
    except Exception:
        pass

    token_buffer: List[str] = []
    current_agent_name: str | None = None

    try:
        async for evt in result.stream_events():
            if isinstance(evt, RawResponsesStreamEvent):
                tok = _token_event_from_raw(evt.data)
                if tok:
                    if tok["type"] == "message_start":
                        token_buffer = []
                    elif tok["type"] == "token_delta":
                        text = tok.get("text")
                        if isinstance(text, str):
                            token_buffer.append(text)
                    elif tok["type"] == "message_end":
                        text = "".join(token_buffer).strip()
                        if text:
                            step = {"type": "message", "agent": current_agent_name, "text": text}
                            steps.append(step)
                            last_message = text
                            yield _sse("reasoning_step", step)
                    yield _sse("token", tok)
                continue

            if isinstance(evt, RunItemStreamEvent):
                step = _step_from_run_item_event(evt)
                if step:
                    steps.append(step)
                    if step.get("type") == "message":
                        last_message = step.get("text")
                    yield _sse("reasoning_step", step)
                continue

            if isinstance(evt, AgentUpdatedStreamEvent):
                current_agent_name = getattr(evt.new_agent, "name", None)
                step = {"type": "agent_switched", "agent": current_agent_name}
                steps.append(step)
                yield _sse("reasoning_step", step)
                continue
    except Exception as e:
        yield _sse("error", {"message": str(e)})

    final_output = result.final_output
    if hasattr(final_output, "model_dump"):
        final_output = final_output.model_dump(exclude_unset=True)
    # Persist steps into session for UX summaries
    if session is not None:
        try:
            session.last_steps = steps
        except Exception:
            pass
    yield _sse("final", {"steps": steps, "final_message": last_message, "final_output": final_output})
