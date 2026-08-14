[CmdletBinding()]
param(
  [int]$Port = 8787,
  [string]$LabCameraId,
  [string]$LabRtspUrl = 'rtsp://127.0.0.1:8554/camera1',
  [string]$LabStreamPath = 'camera1'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$configPath = Join-Path $env:APPDATA 'EduManager\camera-gateway\config.json'
if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Host 'AGUARDANDO PAIRING: execute camera-gateway pair antes de iniciar.'
  exit 0
}

$arguments = @('run', 'camera-gateway', '--', 'start', '--port', $Port)
if ($LabCameraId) { $arguments += @('--lab-camera-id', $LabCameraId, '--lab-rtsp-url', $LabRtspUrl, '--lab-stream-path', $LabStreamPath) }
$process = Start-Process -FilePath 'npm.cmd' -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
Write-Host "Gateway iniciado. PID: $($process.Id)"
