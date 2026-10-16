@echo off
echo ========================================================
echo Unblocking Python and Port 8000 in Windows Firewall...
echo ========================================================
netsh advfirewall firewall delete rule name="FastAPI 8000" >nul 2>&1
netsh advfirewall firewall add rule name="FastAPI 8000" dir=in action=allow protocol=TCP localport=8000
powershell -Command "Set-NetFirewallRule -DisplayName 'python.exe' -Action Allow -ErrorAction SilentlyContinue"
echo.
echo [SUCCESS] Python and Port 8000 have been unblocked!
echo Mobile phones on your Wi-Fi can now connect directly.
echo ========================================================
pause
