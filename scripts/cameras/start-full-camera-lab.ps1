[CmdletBinding()]
param(
  [string]$MediaMtxPath = $env:MEDIAMTX_PATH,
  [string]$WebcamName,
  [int]$WebcamIndex = 0,
  [string]$StreamPath = 'camera1',
  [string]$LabCameraId = 'camera-1',
  [string]$AllowedOrigins = $env:CAMERA_GATEWAY_ALLOWED_ORIGINS
)

$ErrorActionPreference = 'Stop'
$stateDir = Join-Path $env:APPDATA 'EduManager\camera-gateway\camera-lab'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
$ffprobe = (Get-Command ffprobe -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg -or -not $ffprobe) { throw 'FFmpeg e FFprobe precisam estar no PATH.' }

if (-not $MediaMtxPath) { $MediaMtxPath = Join-Path $env:LOCALAPPDATA 'EduManager\camera-lab\mediamtx.exe' }
if (-not (Test-Path -LiteralPath $MediaMtxPath)) { throw 'MediaMTX nao encontrado. Informe -MediaMtxPath ou MEDIAMTX_PATH.' }

$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$deviceListing = (& $ffmpeg -hide_banner -list_devices true -f dshow -i dummy 2>&1 | Out-String)
$ErrorActionPreference = $previousErrorAction
if ([string]::IsNullOrWhiteSpace($WebcamName)) {
  $videoDevices = [regex]::Matches($deviceListing, '"([^"]+)"\s+\(video\)') |
    ForEach-Object { $_.Groups[1].Value } |
    Select-Object -Unique
  if ($WebcamIndex -lt 0 -or $WebcamIndex -ge $videoDevices.Count) {
    throw "WebcamIndex fora do intervalo. Dispositivos de video encontrados: $($videoDevices.Count)."
  }
  $WebcamName = $videoDevices[$WebcamIndex]
}
if (-not $deviceListing.Contains("`"$WebcamName`"")) { throw 'Webcam nao encontrada entre os dispositivos DirectShow.' }

$mediaMtxConfig = Join-Path (Split-Path -Parent $MediaMtxPath) 'mediamtx.yml'
$mediaMtx = Get-Process -Name 'mediamtx' -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $MediaMtxPath } |
  Select-Object -First 1
if (-not $mediaMtx) {
  $mediaMtxArgs = if (Test-Path -LiteralPath $mediaMtxConfig) { @($mediaMtxConfig) } else { @() }
  $mediaMtx = Start-Process -FilePath $MediaMtxPath -ArgumentList $mediaMtxArgs -WorkingDirectory (Split-Path -Parent $MediaMtxPath) -WindowStyle Hidden -PassThru
  $mediaMtx.Id | Set-Content -Path (Join-Path $stateDir 'mediamtx.pid') -Encoding ascii
  Start-Sleep -Seconds 2
}

$ffmpegArgs = @('-hide_banner', '-loglevel', 'warning', '-f', 'dshow', '-video_size', '640x480', '-framerate', '30', '-i', "`"video=$WebcamName`"", '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-f', 'rtsp', "rtsp://127.0.0.1:8554/$StreamPath")
$publisher = Start-Process -FilePath $ffmpeg -ArgumentList $ffmpegArgs -WorkingDirectory $stateDir -WindowStyle Hidden -PassThru
$publisher.Id | Set-Content -Path (Join-Path $stateDir 'ffmpeg.pid') -Encoding ascii
Write-Host "MediaMTX ONLINE: PID $($mediaMtx.Id)"
Write-Host "FFmpeg webcam ONLINE: PID $($publisher.Id)"
Write-Host "RTSP: rtsp://127.0.0.1:8554/$StreamPath"
Start-Sleep -Seconds 2
$probeOutput = & $ffprobe -v error -rtsp_transport tcp -show_entries stream=codec_type,codec_name,width,height,r_frame_rate -of json "rtsp://127.0.0.1:8554/$StreamPath" 2>&1
if ($LASTEXITCODE -ne 0) { throw 'RTSP TEST: FAIL. FFprobe nao conseguiu ler a webcam publicada.' }
Write-Host 'RTSP TEST: PASS'
$gatewayArgs = @{ LabCameraId = $LabCameraId; LabRtspUrl = "rtsp://127.0.0.1:8554/$StreamPath"; LabStreamPath = $StreamPath }
if ($AllowedOrigins) { $gatewayArgs.AllowedOrigins = $AllowedOrigins }
& "$PSScriptRoot\gateway-start.ps1" @gatewayArgs
& "$PSScriptRoot\gateway-status.ps1"
