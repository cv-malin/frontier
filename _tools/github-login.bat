@echo off
setlocal
set "GITBIN=C:\Users\Administrator\.workbuddy\binaries\PortableGit\versions\1.3.0\mingw64\bin"
set "PATH=%GITBIN%;%PATH%"

echo.
echo  ==========================================================
echo   GitHub sign-in  ^|  account: cv-malin
echo  ==========================================================
echo.
echo   A device code like  XXXX-XXXX  will appear below.
echo   Open this page and paste it:
echo.
echo        https://github.com/login/device
echo.
echo   No token needed. The window continues by itself.
echo.

if not exist "%GITBIN%\git-credential-manager.exe" (
  echo  [ERROR] git-credential-manager.exe not found at:
  echo          %GITBIN%
  echo  Edit the GITBIN line in this file if PortableGit moved.
  goto :end
)

"%GITBIN%\git-credential-manager.exe" github login --device --username cv-malin

if errorlevel 1 (
  echo.
  echo  [FAILED] Authorization did not complete.
  echo           Run this file again, or use a personal access token instead.
) else (
  echo.
  echo  [OK] Credentials saved to Windows Credential Manager.
  echo       Close this window and go back to the chat.
)

:end
echo.
pause
