@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Fail-fast launcher. The PowerShell script never prints credentials.
if not defined JWT (
  echo ERRO: variavel JWT nao configurada.
  goto :failure
)

if not defined ANON_KEY (
  echo ERRO: variavel ANON_KEY nao configurada.
  goto :failure
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\test-account-lifecycle.ps1"
set "SCRIPT_EXIT=%ERRORLEVEL%"

if not "%SCRIPT_EXIT%"=="0" goto :failure

echo.
echo Credenciais removidas desta sessao.
endlocal & set "JWT=" & set "ANON_KEY=" & exit /b 0

:failure
echo.
echo Teste abortado. Nenhum passo posterior sera executado.
echo Credenciais removidas desta sessao.
endlocal & set "JWT=" & set "ANON_KEY=" & exit /b 1
