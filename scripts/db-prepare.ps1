# Select the active database provider for Prisma (Windows).
#
# Prisma's datasource `provider` must be a static literal (it cannot be env()),
# so we swap it here based on DATABASE_PROVIDER (default: sqlite), and copy the
# matching per-provider migrations into the active prisma/migrations/ dir.
#
# Idempotent — re-run anytime. Reads DATABASE_PROVIDER from the environment.

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log($msg) { Write-Host "[db-prepare] $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "[db-prepare] $msg" -ForegroundColor Red; exit 1 }

$Provider = $env:DATABASE_PROVIDER
if (-not $Provider) { $Provider = 'sqlite' }
if ($Provider -ne 'sqlite' -and $Provider -ne 'postgresql') {
  Die "DATABASE_PROVIDER='$Provider' is invalid. Use 'sqlite' or 'postgresql'."
}

# Provider value (postgresql) differs from the migrations dir suffix (postgres).
$ProviderDir = if ($Provider -eq 'postgresql') { 'postgres' } else { $Provider }

$Schema        = Join-Path $RepoRoot 'back-end/prisma/schema.prisma'
$MigrationsDir = Join-Path $RepoRoot 'back-end/prisma/migrations'
$SrcDir        = Join-Path $RepoRoot "back-end/prisma/migrations-$ProviderDir"

if (-not (Test-Path $Schema)) { Die "schema not found at $Schema" }
if (-not (Test-Path $SrcDir)) { Die "migrations source dir not found at $SrcDir" }

# 1. Swap the datasource provider line to the chosen provider. Match only the
#    provider inside the datasource block (`  provider = "sqlite|postgresql"`),
#    not the generator's `provider = "prisma-client-js"`.
$content = Get-Content $Schema -Raw
$content = [regex]::Replace(
  $content,
  '(?m)^(\s*provider\s*=\s*)"(sqlite|postgresql)"',
  "`$1`"$Provider`""
)
Set-Content -Path $Schema -Value $content -NoNewline

# 2. Wipe + copy the matching migrations into the active dir (copy, not symlink,
#    so it works on Windows too).
if (Test-Path $MigrationsDir) { Remove-Item -Recurse -Force $MigrationsDir }
New-Item -ItemType Directory -Path $MigrationsDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $SrcDir '*') $MigrationsDir

Log "provider=$Provider (schema + migrations from migrations-$ProviderDir/)"
