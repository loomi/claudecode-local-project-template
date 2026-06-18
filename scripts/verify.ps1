# End-of-turn verification for Windows.
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log($m) { Write-Host "[verify] $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "[verify] $m" -ForegroundColor Red; exit 1 }

if (-not (Test-Path back-end/node_modules) -or -not (Test-Path front-end/node_modules)) {
  Log "node_modules missing — run 'make setup' first"
  exit 0
}

Log "back-end: lint"
Push-Location back-end; try { npm run lint --silent } catch { Pop-Location; Fail "back-end lint failed" }; Pop-Location

Log "back-end: build"
Push-Location back-end; try { npm run build --silent } catch { Pop-Location; Fail "back-end build failed" }; Pop-Location

Log "front-end: typecheck"
Push-Location front-end; try { npm run typecheck --silent } catch { Pop-Location; Fail "front-end typecheck failed" }; Pop-Location

Log "all green"
