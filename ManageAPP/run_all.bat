@echo off
title MaterialMApp Launcher
echo ===================================================
echo Starting MaterialMApp (FastAPI + React Native Expo)
echo ===================================================

start "MaterialMApp Backend" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak > nul

start "MaterialMApp Frontend" cmd /k "cd frontend && npx expo start --web --port 8081"
timeout /t 5 /nobreak > nul

start http://localhost:8081
echo Both servers started!
echo Frontend: http://localhost:8081
echo Backend:  http://localhost:8000/docs
