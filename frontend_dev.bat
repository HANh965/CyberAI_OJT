@echo off
title CAI_LO - Front-end Hot-Reload Dev Server (Port 5173)
cd /d "%~dp0frontend"
echo [*] Khoi dong Vite Development Server voi Hot-Reload tuc thi...
echo [*] Proxy tu dong ve backend CAI Controller tai http://127.0.0.1:8000
echo.
npm run dev
pause

