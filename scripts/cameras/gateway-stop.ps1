[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$pidPath = Join-Path $env:APPDATA 'EduManager\camera-gateway\gateway.pid'
if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Host 'Gateway nao esta registrado como ativo.'
  exit 0
}

$pidValue = Get-Content -LiteralPath $pidPath -Raw
if ($pidValue -notmatch '^\d+$') { throw 'PID do gateway invalido.' }
$process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
if ($process) {
  $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$pidValue").CommandLine
  if ($commandLine -notmatch 'camera-gateway') { throw 'PID registrado nao pertence ao camera-gateway.' }
  Stop-Process -Id ([int]$pidValue) -Force
}
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Write-Host 'Gateway encerrado.'
