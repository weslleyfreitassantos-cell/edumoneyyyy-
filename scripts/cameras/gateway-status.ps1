[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
& npm.cmd run camera-gateway -- status
