@echo off
title CAI - Web Pentest Dashboard (Port 8000)
chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==============================================================================
echo      CAI_LO - Autonomous Agent Pentest Dashboard + Kali Reverse Runner
echo ==============================================================================
echo.

set "PORT=8000"
set "CAI_API_HOST=0.0.0.0"
set "CAI_API_PORT=%PORT%"
set "CAI_API_SERVE_UI=true"
set "CAI_API_MODE=true"
set "CAI_YOLO=1"
set "CAI_GUARDRAILS=false"
set "CAI_SENSITIVE_GUARD=false"
set "CAI_FETCH_ALLOW_INTERNAL=true"
set "CAI_LICENSE_OFF=1"
set "CAI_UNRESTRICTED=1"
set "CAI_CYBER_PROFILE_UNRESTRICTED_MODE=off"
set "PROMPT_TOOLKIT_NO_CPR=1"
set "PYTHONPATH=%~dp0src"

echo [*] Giai phong cong %PORT% neu co tien trinh cu dang chay...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /r ":%PORT%\>.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Dang khoi dong Web Dashboard va cho server san sang tai: http://127.0.0.1:%PORT%/ui
echo [*] Lang nghe ket noi Reverse Runner tu Kali tren cong %PORT% (0.0.0.0:%PORT%)
echo.

:: Background watcher: Cho den khi server phan hoi ok thi moi mo trinh duyet (tranh loi ERR_CONNECTION_REFUSED)
start "" /b cmd /c "for /l %%i in (1,1,40) do (curl.exe -s -m 1 http://127.0.0.1:%PORT%/api/v1/health 2>nul | findstr /i "ok" >nul && (timeout /t 1 /nobreak >nul & start "" http://127.0.0.1:%PORT%/ui & exit) || ping -n 2 127.0.0.1 >nul)"

if exist "%~dp0cai_env\Scripts\python.exe" goto :RUN_WINDOWS
goto :RUN_WSL

:RUN_WINDOWS
echo [*] Khoi dong CAI Controller truc tiep tren Windows - ho tro VMware va VirtualBox...
"%~dp0cai_env\Scripts\python.exe" -c "import os, sys; sys.path.insert(0, os.path.abspath('src')); os.environ['PYTHONIOENCODING']='utf-8'; from dotenv import load_dotenv; load_dotenv(); from cai.api.server import run_api_server; run_api_server(host='0.0.0.0', port=%PORT%)"
goto :DONE

:RUN_WSL
echo [*] Khoi dong CAI Controller qua WSL...
set "WSLDIR="
for /f "usebackq delims=" %%p in (`wsl.exe bash -lc "wslpath -a '%~dp0'" 2^>nul`) do set "WSLDIR=%%p"
wsl.exe bash -lc "cd '!WSLDIR!' && bash run_webui.sh"
goto :DONE

:DONE

echo.
echo [INFO] Server da dung.
pause
