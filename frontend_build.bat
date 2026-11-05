@echo off
title CAI_LO - Build Front-end Next-Gen
cd /d "%~dp0frontend"
echo [*] Dang bien dich ma nguon Front-end (React + TypeScript + Three.js + Tailwind CSS)...
call npm run build
echo.
if %ERRORLEVEL% EQU 0 (
    echo [OK] Bien dich thanh cong! Thu muc frontend/dist da san sang phuc vu tai http://127.0.0.1:8000/ui
) else (
    echo [ERROR] Qua trinh bien dich bi loi!
)
pause

