[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$stateDir = Join-Path $env:APPDATA 'EduManager\camera-gateway\camera-lab'
function Stop-OwnedProcess([string]$Name, [string]$ExpectedProcessName) {
  $path = Join-Path $stateDir $Name
  if (-not (Test-Path -LiteralPath $path)) { return }
  $value = Get-Content -LiteralPath $path -Raw
  if ($value -match '^\d+$') {
    $process = Get-Process -Id ([int]$value) -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq $ExpectedProcessName) { Stop-Process -Id ([int]$value) -Force }
  }
  Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
}

& "$PSScriptRoot\gateway-stop.ps1"
Stop-OwnedProcess 'ffmpeg.pid' 'ffmpeg'
Stop-OwnedProcess 'mediamtx.pid' 'mediamtx'
Write-Host 'Laboratorio completo encerrado; somente PIDs registrados foram considerados.'
