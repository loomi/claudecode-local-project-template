# Windows bootstrap. Idempotent — re-run anytime.
#
# Ensures Node 20+ and npm are present (installs via winget if not),
# then installs deps for back-end and front-end, copies .env files,
# and runs the first Prisma migration against SQLite.

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log($msg)  { Write-Host "[setup] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[setup] $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "[setup] $msg" -ForegroundColor Red; exit 1 }

$NodeMinMajor = 20

function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Get-NodeMajor {
  if (-not (Have 'node')) { return 0 }
  try {
    $v = (& node -p "process.versions.node.split('.')[0]") 2>$null
    return [int]$v
  } catch { return 0 }
}

function Install-Node {
  if (Have 'winget') {
    Log "installing Node 20 LTS via winget"
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
  } elseif (Have 'choco') {
    Log "installing Node 20 via chocolatey"
    choco install nodejs-lts -y
  } else {
    Die "Neither winget nor choco available. Install Node 20+ from https://nodejs.org and rerun."
  }
}

function Ensure-Node {
  $current = Get-NodeMajor
  if ($current -ge $NodeMinMajor) {
    Log "Node $(& node -v) OK"
    return
  }
  Warn "Node missing or < $NodeMinMajor. Installing..."
  Install-Node
  $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  if (-not (Have 'node')) { Die "Node install failed — open a new shell and rerun." }
  Log "Node $(& node -v) installed"
}

function Ensure-Npm {
  if (-not (Have 'npm')) { Die "npm not found after Node install — open a new shell and rerun." }
}

function Setup-EnvFile($dir, $example, $target) {
  $tgt = Join-Path $dir $target
  $ex  = Join-Path $dir $example
  if (-not (Test-Path $tgt) -and (Test-Path $ex)) {
    Copy-Item $ex $tgt
    Log "created $tgt from $example"
  } elseif (Test-Path $tgt) {
    Log "$tgt already exists — kept"
  }
}

function Install-Backend {
  Log "installing back-end dependencies"
  Push-Location back-end
  try {
    npm install --no-audit --no-fund --prefer-offline
    Pop-Location
    Setup-EnvFile 'back-end' '.env.example' '.env'

    # Pick the active provider (swaps schema.prisma + copies migrations in).
    # Default sqlite — keeps the zero-daemon promise for `make setup`.
    $provider = $env:DATABASE_PROVIDER
    if (-not $provider) { $provider = 'sqlite' }
    Log "preparing database provider: $provider"
    & powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-prepare.ps1
    if ($LASTEXITCODE -ne 0) { Die "db-prepare failed for provider '$provider'" }

    Push-Location back-end
    Log "running Prisma generate + migrate ($provider)"
    npx prisma generate
    $migrationsDir = 'prisma/migrations'
    $hasMigrations = $false
    if (Test-Path $migrationsDir) {
      $items = Get-ChildItem -Path $migrationsDir -Exclude 'migration_lock.toml'
      if ($items.Count -gt 0) { $hasMigrations = $true }
    }
    if ($provider -eq 'postgresql') {
      # Never `migrate dev` in setup (needs a shadow DB). Deploy committed migrations.
      npx prisma migrate deploy
      if ($LASTEXITCODE -ne 0) {
        Die "Postgres migrate deploy failed. Set DATABASE_URL to a running PostgreSQL (DATABASE_PROVIDER=postgresql) and rerun 'make setup'."
      }
    } elseif ($hasMigrations) {
      npx prisma migrate deploy
    } else {
      npx prisma migrate dev --name init --skip-seed
    }
  } finally {
    if ((Get-Location).Path -ne $RepoRoot) { Pop-Location }
  }
}

function Install-Frontend {
  Log "installing front-end dependencies"
  Push-Location front-end
  try { npm install --no-audit --no-fund --prefer-offline } finally { Pop-Location }
  Setup-EnvFile 'front-end' '.env.example' '.env.local'
}

Ensure-Node
Ensure-Npm
Install-Backend
Install-Frontend

Write-Host ""
Log "done."
Log "  Start everything:    make dev    (or: npm --prefix back-end run start:dev & npm --prefix front-end run dev)"
Log "  Back-end only:       make dev-back"
Log "  Front-end only:      make dev-front"
Log "  Verify (lint/build): make verify"
