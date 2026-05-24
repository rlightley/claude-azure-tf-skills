#!/usr/bin/env bash
set -euo pipefail

BOLD=$(tput bold 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ -n "${WINDIR:-}" ]]; then
  echo "Windows detected. Please use setup.ps1 instead:"
  echo "  powershell -ExecutionPolicy Bypass -File .\\setup.ps1"
  exit 1
fi

echo ""
echo "${BOLD}Azure Terraform Standards — Team Setup${RESET}"
echo "======================================="
echo ""

# ── Prerequisites check ───────────────────────────────────────────────────────

check_tool() {
  local tool=$1
  local install_hint=$2
  if command -v "$tool" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $tool ($(command -v "$tool"))"
  else
    echo -e "  ${RED}✗${NC} $tool not found"
    echo "    Install: $install_hint"
    MISSING_TOOLS=1
  fi
}

echo "${BOLD}Checking prerequisites...${RESET}"
MISSING_TOOLS=0

check_tool "node"      "macOS: brew install node  |  Linux: https://nodejs.org"
check_tool "npm"       "bundled with Node.js"
check_tool "terraform" "macOS: brew install terraform  |  Linux: https://developer.hashicorp.com/terraform/downloads"
check_tool "tfsec"     "macOS: brew install tfsec  |  Linux: curl -s https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh | bash"
check_tool "git"       "macOS: xcode-select --install  |  Linux: apt install git / yum install git"

echo ""

if [[ $MISSING_TOOLS -eq 1 ]]; then
  echo -e "${YELLOW}Warning: some tools are missing. Install them before using all features.${RESET}"
  echo ""
fi

# ── MCP server build ─────────────────────────────────────────────────────────

MCP_DIR="$SCRIPT_DIR/mcp-servers/azure-tf-advisor"

echo "${BOLD}Building azure-tf-advisor MCP server...${RESET}"

if [[ ! -d "$MCP_DIR/node_modules" ]]; then
  echo "  Installing npm dependencies..."
  npm --prefix "$MCP_DIR" install --silent
fi

echo "  Compiling TypeScript..."
npm --prefix "$MCP_DIR" run build

echo -e "  ${GREEN}✓${NC} MCP server built at $MCP_DIR/dist/index.js"
echo ""

# ── Verify .claude/settings.json is in place ─────────────────────────────────

if [[ -f "$SCRIPT_DIR/.claude/settings.json" ]]; then
  echo -e "  ${GREEN}✓${NC} .claude/settings.json present (MCP server + hooks configured)"
else
  echo -e "  ${RED}✗${NC} .claude/settings.json missing — MCP server will not load"
fi
echo ""

# ── tfsec configuration ───────────────────────────────────────────────────────

echo "${BOLD}Checking tfsec version...${RESET}"
if command -v tfsec &>/dev/null; then
  tfsec --version 2>/dev/null || true
  echo ""
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo "${BOLD}Setup complete.${RESET}"
echo ""
echo "What's configured:"
echo "  • MCP server   azure-tf-advisor — runs automatically when Claude Code opens this repo"
echo "  • Hook         tfsec scans .tf files automatically after Claude edits them"
echo "  • Commands     /tf-new-project  /tf-new-module  /tf-review  /tf-security"
echo "  • Standards    CLAUDE.md — Claude reads this on every session"
echo ""
echo "Getting started:"
echo "  1. Open this repo in Claude Code (claude .) or VS Code with the Claude extension"
echo "  2. Run ${BOLD}/tf-new-project${RESET} to scaffold your first Azure Terraform project"
echo "  3. Share this repo with your team — they just clone and run ${BOLD}./setup.sh${RESET}"
echo ""
echo "Useful commands:"
echo "  /tf-new-project   — scaffold a new project with standard structure"
echo "  /tf-new-module    — create a reusable module"
echo "  /tf-review        — review code against team standards"
echo "  /tf-security      — security-focused audit with tfsec"
echo ""
