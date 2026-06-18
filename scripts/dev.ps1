# Run back-end + front-end in parallel.
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$back  = Start-Process -PassThru -NoNewWindow -FilePath npm -ArgumentList 'run','start:dev' -WorkingDirectory (Join-Path $RepoRoot 'back-end')
$front = Start-Process -PassThru -NoNewWindow -FilePath npm -ArgumentList 'run','dev'        -WorkingDirectory (Join-Path $RepoRoot 'front-end')

Write-Host "[dev] back-end PID=$($back.Id)  front-end PID=$($front.Id)"
Write-Host "[dev] back:  http://localhost:3001/api  docs: http://localhost:3001/docs"
Write-Host "[dev] front: http://localhost:3000"

try {
  Wait-Process -Id $back.Id, $front.Id
} finally {
  foreach ($p in @($back, $front)) {
    if (-not $p.HasExited) { try { Stop-Process -Id $p.Id -Force } catch {} }
  }
}
