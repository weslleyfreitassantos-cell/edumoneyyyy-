[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$stateDir = Join-Path $PSScriptRoot '.camera-lab'
$pidPath = Join-Path $stateDir 'ffmpeg.pid'
if (Test-Path $pidPath) {
  $pidValue = Get-Content $pidPath -Raw
  if ($pidValue -match '^\d+$') { Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue }
  Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) { docker rm -f edumanager-camera-lab 2>$null | Out-Null }
Write-Host 'Laboratório de câmera encerrado.'
