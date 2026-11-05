import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Stars, Html, Float } from "@react-three/drei";
import * as THREE from "three";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { GraphNode } from "../../types";

// Node 3D Component with hover effect, pulsing animations, and HUD label
const Node3D: React.FC<{
  node: GraphNode;
  position: [number, number, number];
  isSelected: boolean;
  onSelect: (node: GraphNode) => void;
}> = ({ node, position, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Pulse animation for findings and flags
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    if (node.type === "finding") {
      const s = 1 + Math.sin(t * 4) * 0.15;
      meshRef.current.scale.set(s, s, s);
    } else if (node.type === "attacker") {
      meshRef.current.rotation.y = t * 0.4;
      meshRef.current.rotation.x = t * 0.2;
    } else if (hovered) {
      meshRef.current.scale.set(1.25, 1.25, 1.25);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  const { color, emissive, size, geometry } = useMemo(() => {
    switch (node.type) {
      case "attacker":
        return { color: "#3ddc84", emissive: "#1b6f3e", size: 0.9, geometry: "octahedron" };
      case "host":
        return { color: "#00f0ff", emissive: "#005577", size: 0.75, geometry: "sphere" };
      case "port":
        return { color: "#a855f7", emissive: "#4a1d82", size: 0.45, geometry: "box" };
      case "endpoint":
        return { color: "#818cf8", emissive: "#2e3b7c", size: 0.4, geometry: "sphere" };
      case "finding":
        return { color: "#ff3366", emissive: "#880022", size: 0.65, geometry: "sphere" };
      case "flag":
      case "credential":
        return { color: "#fcee0a", emissive: "#887700", size: 0.55, geometry: "octahedron" };
      default:
        return { color: "#4ea1ff", emissive: "#112244", size: 0.5, geometry: "sphere" };
    }
  }, [node.type]);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        {geometry === "octahedron" && <octahedronGeometry args={[size, 1]} />}
        {geometry === "sphere" && <sphereGeometry args={[size, 24, 24]} />}
        {geometry === "box" && <boxGeometry args={[size * 1.3, size * 1.3, size * 1.3]} />}

        <meshStandardMaterial
          color={hovered || isSelected ? "#ffffff" : color}
          emissive={emissive}
          emissiveIntensity={hovered || isSelected ? 2.5 : 1.2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Outer Wireframe Ring for Attacker and Selected Node */}
      {(node.type === "attacker" || isSelected || hovered) && (
        <mesh>
          <ringGeometry args={[size * 1.4, size * 1.5, 32]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} wireframe transparent opacity={0.6} />
        </mesh>
      )}

      {/* Floating 3D HUD Label */}
      <Html distanceFactor={14} position={[0, size + 0.35, 0]} center>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node);
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap cursor-pointer transition-all border ${
            isSelected
              ? "bg-cyber-panel2 border-cyber-cyan text-cyber-cyan font-bold scale-110 shadow-cyan"
              : hovered
              ? "bg-cyber-panel border-cyber-neon text-cyber-neon"
              : "bg-black/70 border-cyber-border/70 text-cyber-text"
          }`}
        >
          {node.label.length > 22 ? node.label.slice(0, 20) + "…" : node.label}
        </div>
      </Html>
    </group>
  );
};

// Laser Energy Beam connecting 2 3D nodes
const LaserBeam: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  color: string;
}> = ({ start, end, color }) => {
  const lineGeometry = useMemo(() => {
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [start, end]);

  return (
    <primitive object={new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.55,
        linewidth: 1.5,
      })
    )} />
  );
};

// Main 3D Matrix Scene
export const CyberMatrix3D: React.FC = () => {
  const { graphData, selectedNode, setSelectedNode } = useCampaignStore();

  // Layout node coordinates in 3D Space
  const { nodePositions, edgesToRender } = useMemo(() => {
    const nodes = graphData?.nodes || [];
    const edges = graphData?.edges || [];
    const posMap: Record<string, [number, number, number]> = {};

    // Center Attacker at origin
    posMap["attacker:kali"] = [0, 0.5, 0];

    const hostNodes = nodes.filter((n) => n.type === "host");
    const otherNodes = nodes.filter((n) => n.type !== "host" && n.type !== "attacker");

    // Arrange Hosts in a circle around origin (r = 6)
    hostNodes.forEach((h, idx) => {
      const angle = (idx / Math.max(1, hostNodes.length)) * Math.PI * 2;
      const r = 5.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      posMap[h.id] = [x, 0.8, z];
    });

    // Arrange Ports, Endpoints, Findings, and Flags around their respective Hosts
    const satellitesByHost: Record<string, GraphNode[]> = {};
    otherNodes.forEach((n) => {
      const hostId = n.meta?.host ? `host:${n.meta.host}` : hostNodes[0]?.id || "attacker:kali";
      if (!satellitesByHost[hostId]) satellitesByHost[hostId] = [];
      satellitesByHost[hostId].push(n);
    });

    Object.entries(satellitesByHost).forEach(([hId, satList]) => {
      const parentPos = posMap[hId] || [0, 0, 0];
      satList.forEach((sat, idx) => {
        const phi = (idx / satList.length) * Math.PI * 2;
        const dist = 2.4 + (idx % 2) * 0.8;
        const sx = parentPos[0] + Math.cos(phi) * dist;
        const sy = parentPos[1] + (Math.sin(phi) * 1.5) + ((idx % 3) - 1) * 0.8;
        const sz = parentPos[2] + Math.sin(phi) * dist;
        posMap[sat.id] = [sx, Math.max(0.2, sy), sz];
      });
    });

    const renderedEdges = edges
      .map((e) => {
        const s = posMap[e.source];
        const d = posMap[e.target];
        if (!s || !d) return null;
        const targetNode = nodes.find((n) => n.id === e.target);
        const col = targetNode?.type === "finding" ? "#ff3366" : targetNode?.type === "flag" ? "#fcee0a" : "#00f0ff";
        return { start: s, end: d, color: col };
      })
      .filter(Boolean) as Array<{ start: [number, number, number]; end: [number, number, number]; color: string }>;

    return { nodePositions: posMap, edgesToRender: renderedEdges };
  }, [graphData]);

  return (
    <div className="w-full h-full relative bg-[#070a0f] overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 10, 16], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        className="cursor-grab active:cursor-grabbing"
      >
        <color attach="background" args={["#070a0f"]} />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 15, 10]} intensity={1.5} color="#00f0ff" />
        <pointLight position={[-10, 15, -10]} intensity={1.5} color="#3ddc84" />
        <pointLight position={[0, -5, 0]} intensity={0.5} color="#b026ff" />

        {/* Star Atmosphere */}
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

        {/* Cyber Hologram Grid Floor */}
        <Grid
          position={[0, -0.05, 0]}
          args={[30, 30]}
          cellSize={1}
          cellThickness={1}
          cellColor="#1d283a"
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor="#00f0ff"
          fadeDistance={25}
          fadeStrength={1.5}
        />

        {/* Laser Beams */}
        {edgesToRender.map((edge, idx) => (
          <LaserBeam key={idx} start={edge.start} end={edge.end} color={edge.color} />
        ))}

        {/* 3D Nodes */}
        {graphData?.nodes?.map((node) => {
          const pos = nodePositions[node.id] || [0, 0, 0];
          return (
            <Float key={node.id} speed={1.2} rotationIntensity={0.2} floatIntensity={0.3}>
              <Node3D
                node={node}
                position={pos}
                isSelected={selectedNode?.id === node.id}
                onSelect={(n) => setSelectedNode(n)}
              />
            </Float>
          );
        })}

        {/* Interactive Camera Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          maxDistance={35}
          minDistance={3}
          maxPolarAngle={Math.PI / 2 + 0.05}
        />
      </Canvas>

      {/* Floating 3D Legend & Controls Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-cyber-panel/80 backdrop-blur-md border border-cyber-border rounded-lg px-3 py-2 text-xs font-mono space-y-1">
          <div className="text-[10px] text-cyber-muted uppercase tracking-wider font-bold">Không gian mạng 3D Matrix</div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-cyber-neon" /> Attacker</span>
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-cyber-cyan" /> Host Target</span>
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-cyber-red" /> Lỗ hổng</span>
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-cyber-amber" /> CTF Flag</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 bg-cyber-panel/80 backdrop-blur-md border border-cyber-border rounded-lg px-2.5 py-1 text-[11px] font-mono text-cyber-muted">
        Xoay chuột 360° · Cuộn để Zoom · Click vào Node để kiểm tra
      </div>
    </div>
  );
};
