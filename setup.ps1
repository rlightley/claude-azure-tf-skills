#Requires -Version 5.1
<#
.SYNOPSIS
    Azure Terraform Standards — Team Setup (Windows)
.DESCRIPTION
    Checks prerequisites, builds the azure-tf-advisor MCP server, and prints getting-started instructions.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepoRoot = $PSScriptRoot

Write-Host ""
Write-Host "Azure Terraform Standards - Team Setup" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# ── Prerequisites check ───────────────────────────────────────────────────────

$MissingTools = $false

function Test-Tool {
    param(
        [string]$Name,
        [string]$WingetId,
        [string]$AltHint
    )
    if (Get-Command $Name -ErrorAction SilentlyContinue) {
        $path = (Get-Command $Name -ErrorAction SilentlyContinue).Source
        Write-Host "  [OK] $Name  ($path)" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $Name" -ForegroundColor Red
        if ($WingetId) {
            Write-Host "    winget: winget install $WingetId"
        }
        if ($AltHint) {
            Write-Host "    or:     $AltHint"
        }
        $script:MissingTools = $true
    }
}

Write-Host "Checking prerequisites..." -ForegroundColor White
Test-Tool "node"      "OpenJS.NodeJS"                 "https://nodejs.org"
Test-Tool "npm"       ""                              "bundled with Node.js"
Test-Tool "terraform" "Hashicorp.Terraform"           "scoop install terraform  |  choco install terraform"
Test-Tool "tfsec"     "aquasecurity.tfsec"            "scoop install tfsec  |  choco install tfsec"
Write-Host ""

if ($MissingTools) {
    Write-Host "Warning: some tools are missing. Install them then re-run this script." -ForegroundColor Yellow
    Write-Host ""
}

# ── Build MCP server ─────────────────────────────────────────────────────────

$McpDir = Join-Path $RepoRoot "mcp-servers\azure-tf-advisor"

Write-Host "Building azure-tf-advisor MCP server..." -ForegroundColor White

if (-not (Test-Path (Join-Path $McpDir "node_modules"))) {
    Write-Host "  Installing npm dependencies..."
    Push-Location $McpDir
    try {
        npm install --silent
    } finally {
        Pop-Location
    }
}

Write-Host "  Compiling TypeScript..."
Push-Location $McpDir
try {
    npm run build
} finally {
    Pop-Location
}

Write-Host "  [OK] MCP server built: $McpDir\dist\index.js" -ForegroundColor Green
Write-Host ""

# ── Verify settings ───────────────────────────────────────────────────────────

$SettingsPath = Join-Path $RepoRoot ".claude\settings.json"
if (Test-Path $SettingsPath) {
    Write-Host "  [OK] .claude\settings.json present (MCP server + hooks configured)" -ForegroundColor Green
} else {
    Write-Host "  [MISSING] .claude\settings.json - MCP server will not load" -ForegroundColor Red
}
Write-Host ""

# ── tfsec version ─────────────────────────────────────────────────────────────

if (Get-Command tfsec -ErrorAction SilentlyContinue) {
    Write-Host "tfsec version:" -ForegroundColor White
    tfsec --version 2>$null
    Write-Host ""
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Host "Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "What's configured:"
Write-Host "  * MCP server   azure-tf-advisor  runs automatically when Claude Code opens this repo"
Write-Host "  * Hook         tfsec scans .tf files automatically after Claude edits them"
Write-Host "  * Commands     /tf-new-project  /tf-new-module  /tf-review  /tf-security"
Write-Host "  * Standards    CLAUDE.md  Claude reads this on every session"
Write-Host ""
Write-Host "Getting started:"
Write-Host "  1. Open this repo in Claude Code:  claude ."
Write-Host "  2. Run /tf-new-project to scaffold your first Azure Terraform project"
Write-Host "  3. Share this repo with your team  they clone and run .\setup.ps1"
Write-Host ""
Write-Host "Useful slash commands:"
Write-Host "  /tf-new-project   scaffold a new project with standard structure"
Write-Host "  /tf-new-module    create a reusable module"
Write-Host "  /tf-review        review code against team standards"
Write-Host "  /tf-security      security-focused audit with tfsec"
Write-Host ""
