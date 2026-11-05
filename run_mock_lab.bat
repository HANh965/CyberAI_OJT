@echo off
chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==============================================================================
echo      CAI_LO - Acme Corp Mock Vulnerable Web Lab (OWASP Top 10)
echo ==============================================================================
echo.

set "PORT=8888"
set "HOST=0.0.0.0"
set "PYTHONPATH=%~dp0src"

echo [*] Giai phong cong %PORT% neu co tien trinh cu dang chay...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /r ":%PORT%\>.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Khoi dong Mock Web Lab tai: http://127.0.0.1:%PORT%
echo [*] Cho phep may ao Kali truy cap qua dia chi IP may host tren cong %PORT%
echo.

:: Background watcher: Cho den khi server phan hoi ok thi moi mo trinh duyet
start "" /b cmd /c "for /l %%i in (1,1,30) do (curl.exe -s -m 1 http://127.0.0.1:%PORT%/api/v1/status 2>nul | findstr /i "online" >nul && (timeout /t 1 /nobreak >nul & start "" http://127.0.0.1:%PORT% & exit) || ping -n 2 127.0.0.1 >nul)"

if exist "%~dp0cai_env\Scripts\python.exe" (
    "%~dp0cai_env\Scripts\python.exe" -c "from cai.lab.server import run_mock_lab_server; run_mock_lab_server(host='%HOST%', port=%PORT%)"
) else (
    python -c "from cai.lab.server import run_mock_lab_server; run_mock_lab_server(host='%HOST%', port=%PORT%)"
)

echo.
echo [INFO] Mock Lab da dung.
pause

