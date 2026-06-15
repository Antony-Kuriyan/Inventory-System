@echo off
echo 🚀 Launching FastAPI Backend on http://127.0.0.1:8000...
start "" "C:\Users\AntonyKuriyanK\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn backend.main:app --port 8000 --reload

echo 🚀 Launching React Frontend on http://127.0.0.1:5173...
start "" cmd /c "cd frontend && npm run dev"

echo ✅ Both servers launched in separate windows!
pause
