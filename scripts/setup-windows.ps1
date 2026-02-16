param(
  [switch]$SkipPlaywright
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
  param([string]$CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Command not found: $CommandName"
  }
}

function Assert-NodeVersion {
  $nodeVersion = (node -v).Trim()
  if ($nodeVersion -notmatch "^v(\d+)") {
    throw "Failed to parse Node version: $nodeVersion"
  }

  $majorVersion = [int]$Matches[1]
  if ($majorVersion -lt 20) {
    throw "Node 20+ is required. Current: $nodeVersion"
  }
}

function New-RandomHexSecret {
  param([int]$ByteLength = 32)

  $bytes = New-Object byte[] $ByteLength
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Ensure-NextAuthSecret {
  if (-not (Test-Path ".env.local")) {
    return
  }

  $content = Get-Content ".env.local" -Raw
  $placeholder = 'NEXTAUTH_SECRET="replace-with-long-random-secret"'
  if ($content -notmatch [regex]::Escape($placeholder)) {
    return
  }

  $secret = New-RandomHexSecret
  $updated = $content -replace [regex]::Escape($placeholder), "NEXTAUTH_SECRET=""$secret"""
  Set-Content ".env.local" -Value $updated -Encoding utf8
  Write-Host "Generated NEXTAUTH_SECRET into .env.local" -ForegroundColor Yellow
}

function Ensure-DatabaseUrl {
  if (-not (Test-Path ".env.local")) {
    return
  }

  $legacy = 'DATABASE_URL="file:./prisma/dev.db"'
  $current = 'DATABASE_URL="file:./dev.db"'
  $content = Get-Content ".env.local" -Raw
  if ($content -notmatch [regex]::Escape($legacy)) {
    return
  }

  $updated = $content -replace [regex]::Escape($legacy), $current
  Set-Content ".env.local" -Value $updated -Encoding utf8
  Write-Host "Updated DATABASE_URL to file:./dev.db in .env.local" -ForegroundColor Yellow
}

function Initialize-EnvFile {
  if (-not (Test-Path ".env.example")) {
    throw ".env.example is missing"
  }

  if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host ".env.local has been created from .env.example" -ForegroundColor Yellow
  }

  Ensure-NextAuthSecret
  Ensure-DatabaseUrl
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")

Push-Location $projectRoot
try {
  Write-Step "Checking PowerShell / Node tooling"
  Assert-Command "node"
  Assert-Command "npm.cmd"
  Assert-Command "npx.cmd"
  Assert-NodeVersion

  Write-Step "Installing dependencies"
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed"
  }

  Write-Step "Preparing environment template"
  Initialize-EnvFile

  Write-Step "Preparing Prisma client and schema"
  & npm.cmd run db:setup
  if ($LASTEXITCODE -ne 0) {
    throw "npm run db:setup failed"
  }

  if (-not $SkipPlaywright) {
    Write-Step "Installing Playwright Chromium"
    & npx.cmd playwright install chromium
    if ($LASTEXITCODE -ne 0) {
      throw "Playwright Chromium install failed"
    }
  }

  Write-Step "Running local doctor checks"
  & npm.cmd run doctor
  if ($LASTEXITCODE -ne 0) {
    throw "npm run doctor failed"
  }

  Write-Host "`nWindows development setup complete" -ForegroundColor Green
  Write-Host "Recommended next steps: npm run lint -> npm test -> npm run dev" -ForegroundColor Green
} finally {
  Pop-Location
}
