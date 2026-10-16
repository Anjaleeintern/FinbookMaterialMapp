@echo off
title MaterialMApp - Backend Server
echo ===================================================
echo Starting MaterialMApp FastAPI Backend on port 8000...
echo ===================================================
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
