@echo off
REM ============================================================
REM  Opens port 3100 so another device on the same Wi-Fi can
REM  reach the Campus Pulse dev server (http://<this-PC>:3100).
REM
REM  HOW TO RUN: right-click this file -> "Run as administrator"
REM  (it needs admin rights because it changes the firewall.)
REM ============================================================

echo.
echo  Adding firewall rule for TCP port 3100 ...
netsh advfirewall firewall add rule name="Campus Pulse dev 3100" dir=in action=allow protocol=TCP localport=3100

echo.
echo  Checking the rule exists:
netsh advfirewall firewall show rule name="Campus Pulse dev 3100"

echo.
echo  Done. Your friend can now open:
echo      http://24.10.24.112:3100
echo.
echo  NOTE: this makes the dev server reachable by anyone on this
echo  network. To remove it later, run as administrator:
echo      netsh advfirewall firewall delete rule name="Campus Pulse dev 3100"
echo.
pause
