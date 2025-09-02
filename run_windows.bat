@echo off
echo Starting HealthGuide Community Development Server...
cd backend
call ../venv/Scripts/activate
python app.py
pause
