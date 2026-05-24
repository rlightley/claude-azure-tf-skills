# Azure Terraform Standards Kit for Claude Code

A shareable configuration kit that makes [Claude Code](https://claude.ai/code) produce secure, consistent, and well-structured Azure Terraform — automatically — across your entire team.

---

## The problem

Most teams using AI to write Terraform run into the same issues:

- **Inconsistent code.** Different engineers get different results. One uses `count`, another uses `for_each`. Resource names follow no convention. Modules are structured differently on every project.
- **Security gaps discovered late.** Storage accounts with public access. Key Vaults without purge protection. SQL servers open to the internet. These get caught in security reviews or, worse, in production.
- **Permission whack-a-mole.** CI/CD pipelines fail with auth errors. The team fixes one role assignment, runs the pipeline again, and hits a different one. Repeat five times per deployment.
- **No tagging discipline.** Finance can't report on costs. Ops can't tell who owns a resource. Compliance audits become painful.
- **Standards that live in a wiki no one reads.** Good intentions, zero enforcement.

---

## How this kit solves it

This repo configures Claude Code at the project level. When any team member opens it, Claude automatically knows your standards and enforces them — no prompting required.

### A `CLAUDE.md` that acts as the single source of truth

Claude reads this file at the start of every session. It defines:

- Microsoft CAF naming conventions for every common Azure resource type
- Required tags and their valid values, with validation rules
- Per-service security requirements (Storage, Key Vault, AKS, App Service, SQL, ACR, Networking)
- Module structure, state management, and code style standards
- How and when to use the MCP server tools

If a standard exists in `CLAUDE.md`, Claude will follow it without being asked.

### An MCP server that validates in real time

`azure-tf-advisor` is a local MCP server that runs alongside Claude Code and exposes four tools Claude uses automatically during every session:

| Tool | What it does |
|---|---|
| `get_secure_template` | Returns hardened HCL for Storage, Key Vault, AKS, App Service, SQL, ACR, and VNet — secure defaults baked in |
| `validate_azure_naming` | Checks every resource name against CAF rules before it's written |
| `validate_required_tags` | Verifies all required tags are present and that `environment` is a valid value |
| `tfsec_scan` | Runs tfsec on demand and surfaces findings with severity |
| `get_required_permissions` | Returns the exact `azurerm_role_assignment` HCL needed for any consumer–target pairing |

### Five slash commands for guided workflows

Type these in Claude Code to trigger structured workflows:

| Command | What it does |
|---|---|
| `/tf-new-project` | Scaffolds a complete project: environments, modules, backends, `.tfsec` config, and `.gitignore` |
| `/tf-new-module` | Creates a reusable module with `main.tf`, `variables.tf`, `outputs.tf`, and `versions.tf` — pre-populated with secure defaults |
| `/tf-review` | Audits a directory against all team standards and returns a severity-rated findings report |
| `/tf-security` | Deep security audit: tfsec, hardcoded secrets scan, network exposure, identity checks — with exact remediation code |
| `/tf-permissions` | Reads your `.tf` files, identifies every resource-to-resource relationship, and generates all missing `azurerm_role_assignment` blocks in one shot |

### Automatic tfsec scanning

A hook runs tfsec automatically every time Claude edits a `.tf` file. HIGH and CRITICAL findings appear in the conversation immediately, so problems are caught during generation rather than in the pipeline.

---

## Getting started

### Prerequisites

| Tool | Windows | macOS | Linux |
|---|---|---|---|
| Node.js 18+ | `winget install OpenJS.NodeJS` | `brew install node` | https://nodejs.org |
| Terraform | `winget install Hashicorp.Terraform` | `brew install terraform` | https://developer.hashicorp.com/terraform/downloads |
| tfsec | `winget install aquasecurity.tfsec` | `brew install tfsec` | `curl -s https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh \| bash` |
| Claude Code | https://claude.ai/code | | |

### Setup

**Windows:**
```powershell
git clone <your-fork-url>
cd claude-azure-tf-skills
.\setup.ps1
```

**macOS / Linux:**
```bash
git clone <your-fork-url>
cd claude-azure-tf-skills
./setup.sh
```

The setup script checks prerequisites, installs npm dependencies, and compiles the MCP server.

### First use

Open the repo in Claude Code:

```bash
claude .
```

Then run your first command:

```
/tf-new-project
```

Claude will ask for your project name, environments, and region, then scaffold the full structure with secure defaults and run tfsec on the result.

---

## What gets enforced

### Naming (Microsoft CAF)

Every resource name is validated against the [Cloud Adoption Framework](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming) before it's written. Wrong prefix, wrong length, hyphens where they're not allowed — all caught before the code is committed.

### Required tags

Resources without `environment`, `project`, `cost_center`, and `owner` tags will be flagged. `environment` must be one of `dev`, `staging`, or `prod`.

### Security baselines

A sample of what's enforced per resource type:

- **Storage accounts:** HTTPS only, TLS 1.2, no public blob access, shared access keys disabled, network default action `Deny`
- **Key Vaults:** soft delete (90 days), purge protection, RBAC auth (no legacy access policies), network ACLs `Deny`
- **AKS:** private cluster (staging/prod), RBAC + Entra auth, network policy enabled
- **App Service:** HTTPS only, TLS 1.2, FTPS disabled, system-assigned managed identity
- **SQL:** TLS 1.2, public access disabled, Entra-only auth, extended auditing, threat detection, vulnerability assessment

### Permissions

The `get_required_permissions` tool covers the most common pipeline-breaking patterns:

- Function App → Storage Account (three roles, all required for the runtime)
- AKS → Container Registry (`kubelet_identity`, not `identity` — a very common mistake)
- App Service → Key Vault, Service Bus, Event Hub
- SQL Server → Storage (for auditing)
- Data Factory → Key Vault and Storage

---

## Customising for your team

This kit is designed to be forked and adapted. Here are the most common things teams change:

### Change required tags

Edit `REQUIRED_TAG_KEYS` and `VALID_ENVIRONMENTS` in `mcp-servers/azure-tf-advisor/src/index.ts`, then rebuild:

```bash
npm run build --prefix mcp-servers/azure-tf-advisor
```

### Add a new secure template

Add a new entry to the `SECURE_TEMPLATES` object in `src/index.ts`. The key is the `azurerm_*` resource type. Follow the existing patterns — include managed identity, diagnostic settings, and tags on every resource.

### Add a new permission pattern

Add an entry to `PERMISSION_PATTERNS` in `src/index.ts`. The structure is:

```typescript
azurerm_your_consumer: {
  azurerm_your_target: {
    read: [{ role: "Role Name", principalRef: "azurerm_your_consumer.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_your_target.TARGET.id", description: "..." }],
    write: [...],
    notes: "Any gotchas worth flagging",
  },
},
```

### Change naming rules

Edit `NAMING_RULES` in `src/index.ts`. Each entry has a prefix, length limits, a regex pattern, and a description used in error messages.

### Tighten or relax tfsec

Edit `.tfsec/config.yml` in any Terraform project to adjust minimum severity or exclude specific checks:

```yaml
minimum_severity: HIGH
exclude:
  - azure-storage-use-secure-tls-policy  # already enforced in Terraform
```

### Add a custom slash command

Create a new `.md` file in `.claude/commands/`. The filename becomes the command name. Write it as instructions to Claude — describe the inputs to collect, the steps to follow, and the output format. No code required.

---

## Contributing

Contributions are welcome and encouraged. If you've added resource types, fixed an edge case, or found a better way to handle a permission pattern, please share it.

**Good places to start:**

- **New secure templates** — `azurerm_cognitive_account`, `azurerm_servicebus_namespace`, `azurerm_eventhub_namespace`, `azurerm_redis_cache`
- **New permission patterns** — Logic Apps, Cognitive Services, API Management, Synapse
- **New naming rules** — anything missing from the CAF table
- **New slash commands** — `/tf-cost-estimate`, `/tf-drift-check`, `/tf-docs`
- **Bug fixes** — wrong role name, incorrect principal reference, regex that's too strict or too loose

To contribute:

1. Fork the repo
2. Make your changes
3. Test by opening the repo in Claude Code and running the affected commands
4. Open a pull request with a short description of what you changed and why

If you've adapted this kit for a different cloud provider or a non-Azure stack, consider publishing your fork — the pattern works anywhere Claude Code is used.

---

## Project structure

```
claude-azure-tf-skills/
├── CLAUDE.md                        # Team standards — Claude reads this every session
├── .claude/
│   ├── settings.json                # MCP server registration + tfsec hook
│   └── commands/                   # Slash commands
│       ├── tf-new-project.md
│       ├── tf-new-module.md
│       ├── tf-review.md
│       ├── tf-security.md
│       └── tf-permissions.md
├── mcp-servers/
│   └── azure-tf-advisor/
│       ├── src/index.ts             # MCP server — naming, templates, tfsec, permissions
│       ├── package.json
│       └── tsconfig.json
├── setup.sh                         # macOS / Linux onboarding
└── setup.ps1                        # Windows onboarding
```

---

## Licence

MIT. Fork it, adapt it, make it your own.
