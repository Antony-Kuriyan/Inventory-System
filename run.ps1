# Launch FastAPI backend in a new window
Write-Host "🚀 Launching FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
Start-Process -FilePath "C:\Users\AntonyKuriyanK\AppData\Local\Programs\Python\Python312\python.exe" -ArgumentList "-m uvicorn backend.main:app --reload --port 8000"

# Launch React frontend in a new window
Write-Host "🚀 Launching React Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd frontend && npm run dev"

Write-Host "✅ Both servers launched in separate terminal windows!" -ForegroundColor Green
