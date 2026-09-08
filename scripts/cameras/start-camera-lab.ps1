[CmdletBinding()]
param(
  [ValidateSet('testpattern', 'file', 'webcam')]
  [string]$Mode = 'testpattern',
  [string]$InputPath,
  [int]$WebcamIndex = 0,
  [string]$WebcamName,
  [string]$StreamName = 'camera-1',
  [int]$RtspPort = 8554
)

$ErrorActionPreference = 'Stop'
$stateDir = Join-Path $PSScriptRoot '.camera-lab'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

function Stop-ExistingLab {
  $pidPath = Join-Path $stateDir 'ffmpeg.pid'
  if (Test-Path $pidPath) {
    $oldPid = Get-Content $pidPath -Raw
    if ($oldPid -match '^\d+$') {
      Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
  }
}

Stop-ExistingLab

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  throw 'Docker não encontrado. Instale/inicie o Docker Desktop ou use MediaMTX localmente.'
}

$container = docker ps -a --filter 'name=^edumanager-camera-lab$' --format '{{.Names}}'
if ($container) { docker rm -f edumanager-camera-lab | Out-Null }
docker run -d --name edumanager-camera-lab -p "$RtspPort`:8554" -p '8888:8888' bluenviron/mediamtx:1.15.0 | Out-Null

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
  Write-Host 'MediaMTX iniciado. FFmpeg não encontrado; o gateway ainda pode publicar um stream externo.'
  Write-Host "Endpoint de laboratório: rtsp://127.0.0.1:$RtspPort/$StreamName"
  exit 0
}

$args = @('-hide_banner', '-loglevel', 'warning', '-re', '-an')
switch ($Mode) {
  'testpattern' { $args += @('-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=15') }
  'file' {
    if (-not $InputPath -or -not (Test-Path -LiteralPath $InputPath)) { throw 'Informe -InputPath para o modo file.' }
    $args = @('-hide_banner', '-loglevel', 'warning', '-stream_loop', '-1', '-re', '-i', $InputPath, '-an')
  }
  'webcam' {
    if ([string]::IsNullOrWhiteSpace($WebcamName)) {
      $previousErrorAction = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $deviceListing = (& $ffmpeg.Source -hide_banner -list_devices true -f dshow -i dummy 2>&1 | Out-String)
      $ErrorActionPreference = $previousErrorAction
      $videoDevices = [regex]::Matches($deviceListing, '"([^"]+)"\s+\(video\)') |
        ForEach-Object { $_.Groups[1].Value } |
        Select-Object -Unique
      if ($WebcamIndex -lt 0 -or $WebcamIndex -ge $videoDevices.Count) {
        throw "WebcamIndex fora do intervalo. Dispositivos de video encontrados: $($videoDevices.Count)."
      }
      $WebcamName = $videoDevices[$WebcamIndex]
    }
    $args = @('-hide_banner', '-loglevel', 'warning', '-f', 'dshow', '-i', "`"video=$WebcamName`"", '-an')
  }
}
$args += @('-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-f', 'rtsp', "rtsp://127.0.0.1:$RtspPort/$StreamName")

$process = Start-Process -FilePath $ffmpeg.Source -ArgumentList $args -WindowStyle Hidden -PassThru
$process.Id | Set-Content -Path (Join-Path $stateDir 'ffmpeg.pid')
Write-Host "Laboratório iniciado: $Mode"
Write-Host "Stream RTSP somente para o gateway local: rtsp://127.0.0.1:$RtspPort/$StreamName"
Write-Host 'Não use essa URL no navegador ou no frontend.'
