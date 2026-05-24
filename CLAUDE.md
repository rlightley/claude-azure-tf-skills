# Azure Terraform Team Standards

You are an expert Azure infrastructure engineer. When working on Terraform code in this project, follow these standards without exception. They exist to ensure security, consistency, and maintainability across the team.

---

## Before Writing Any Terraform Code

1. Call `get_secure_template` from the `azure-tf-advisor` MCP server for any new resource type
2. Validate every proposed resource name with `validate_azure_naming`
3. After writing Terraform files, run `tfsec_scan` on the directory and fix all CRITICAL and HIGH findings before considering the task done

---

## Project Structure

Every Terraform project MUST use this layout. Never deviate:

```
<project-name>/
├── modules/
│   └── <module-name>/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── versions.tf
│       └── README.md
├── environments/
│   ├── dev/
│   │   ├── main.tf            # Module calls and data sources only
│   │   ├── variables.tf
│   │   ├── terraform.tfvars   # Never commit real secrets
│   │   ├── terraform.tfvars.example
│   │   ├── outputs.tf
│   │   └── backend.tf
│   ├── staging/
│   └── prod/
├── .tfsec/
│   └── config.yml
├── .terraform.lock.hcl        # Always commit this file
└── .gitignore
```

---

## Naming Conventions (Microsoft CAF)

Pattern: `<abbreviation>-<workload>-<environment>-<region>-<instance>`
For resources that prohibit hyphens (storage accounts, container registries): omit hyphens entirely.

| Resource Type (azurerm_*) | Prefix | Max Len | Example |
|---|---|---|---|
| `resource_group` | `rg` | 90 | `rg-payments-prod-uks-001` |
| `virtual_network` | `vnet` | 64 | `vnet-payments-prod-uks-001` |
| `subnet` | `snet` | 80 | `snet-web-prod-uks-001` |
| `network_security_group` | `nsg` | 80 | `nsg-web-prod-uks-001` |
| `storage_account` | `st` | 24 | `stpaymentsprduks001` |
| `key_vault` | `kv` | 24 | `kv-payments-prd-uks` |
| `kubernetes_cluster` | `aks` | 63 | `aks-payments-prod-uks-001` |
| `app_service_plan` | `asp` | 40 | `asp-payments-prod-uks-001` |
| `linux_web_app` / `windows_web_app` | `app` | 60 | `app-payments-prod-uks-001` |
| `mssql_server` | `sql` | 63 | `sql-payments-prod-uks-001` |
| `mssql_database` | `sqldb` | 128 | `sqldb-payments-prod-uks-001` |
| `container_registry` | `cr` | 50 | `crpaymentsprduks001` |
| `log_analytics_workspace` | `log` | 63 | `log-payments-prod-uks-001` |
| `user_assigned_identity` | `id` | 128 | `id-payments-prod-uks-001` |
| `private_endpoint` | `pep` | 80 | `pep-payments-prod-uks-001` |
| `virtual_machine` | `vm` | 15 (Windows) / 64 (Linux) | `vm-payments-prod-uks-001` |

---

## Required Tags

Every resource block MUST include tags. No exceptions.

```hcl
tags = merge(var.tags, {
  managed_by = "terraform"
})
```

Root `variables.tf` MUST define `var.tags` with validation:

```hcl
variable "tags" {
  description = "Required tags applied to all resources"
  type = object({
    environment = string
    project     = string
    cost_center = string
    owner       = string
  })
  validation {
    condition     = contains(["dev", "staging", "prod"], var.tags.environment)
    error_message = "tags.environment must be one of: dev, staging, prod"
  }
}
```

---

## Security Requirements

### Universal (all resources)
- NEVER hardcode credentials, passwords, keys, or connection strings
- ALWAYS retrieve secrets via `data "azurerm_key_vault_secret"`
- ALWAYS use managed identities — minimum `SystemAssigned` on all compute resources
- ALWAYS send diagnostic logs to a Log Analytics workspace (`azurerm_monitor_diagnostic_setting`)
- ALWAYS pin provider and module versions

### Networking
- Every subnet MUST reference an NSG via `azurerm_subnet_network_security_group_association`
- NSG rules MUST NOT expose RDP (3389) or SSH (22) to `0.0.0.0/0`
- NSG rules using `*` for both source and destination require an inline comment explaining why
- All PaaS services MUST use private endpoints where the provider supports it
- Public IP addresses require an explicit comment justifying the exposure

### Storage Accounts

```hcl
https_traffic_only_enabled      = true       # required
min_tls_version                 = "TLS1_2"  # required
allow_nested_items_to_be_public = false       # required
shared_access_key_enabled       = false       # required — use Entra ID auth
network_rules {
  default_action = "Deny"                    # required
  bypass         = ["AzureServices"]
}
```

### Key Vault

```hcl
soft_delete_retention_days = 90              # required (min 7, prefer 90)
purge_protection_enabled   = true            # required in staging and prod
enable_rbac_authorization  = true            # required — no legacy access policies
network_acls {
  default_action = "Deny"                    # required
  bypass         = "AzureServices"
}
```

### AKS

```hcl
private_cluster_enabled             = true   # required in staging and prod
role_based_access_control_enabled   = true   # required
azure_active_directory_role_based_access_control {
  azure_rbac_enabled = true                  # required
}
network_profile {
  network_policy = "azure"                   # required (or "calico")
}
```

### App Service

```hcl
https_only = true                            # required
site_config {
  minimum_tls_version = "1.2"              # required
  ftps_state          = "Disabled"          # required
}
identity {
  type = "SystemAssigned"                   # required
}
```

### SQL / MSSQL

```hcl
# On azurerm_mssql_server:
minimum_tls_version           = "1.2"       # required
public_network_access_enabled = false        # required
azuread_administrator { ... }               # required — Entra-only auth

# Always pair with:
resource "azurerm_mssql_server_extended_auditing_policy" ...
resource "azurerm_mssql_server_security_alert_policy" ...
resource "azurerm_mssql_server_vulnerability_assessment" ...
```

### Container Registry

```hcl
admin_enabled                 = false        # required
public_network_access_enabled = false        # required
network_rule_set {
  default_action = "Deny"                    # required
}
```

---

## Module Standards

Every module MUST:
- Have `versions.tf` with pinned provider versions
- Declare type constraints and descriptions on every variable in `variables.tf`
- Export all useful attributes in `outputs.tf`
- Accept `var.tags`, `var.location`, and `var.resource_group_name` — never hardcode these
- NOT create the resource group it lives in — callers own resource group lifecycle
- Include `lifecycle { prevent_destroy = true }` on stateful resources deployed to prod

**versions.tf template for every module:**

```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }
}
```

---

## State Management

All remote state MUST be stored in Azure Blob Storage. Each environment has its own state file:

```hcl
# environments/<env>/backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfstate-shared-uks-001"
    storage_account_name = "sttfstateshareduks001"
    container_name       = "tfstate"
    key                  = "<project>/<environment>/terraform.tfstate"
  }
}
```

The tfstate storage account must have:
- `versioning_enabled = true` on blob properties
- `delete_retention_policy` of at least 30 days
- Network rules set to `Deny` (allow only from pipeline IP ranges or private endpoint)

---

## Code Style

- Use `for_each` over `count` for any resource that may be individually addressed or removed
- Use `locals {}` for any expression used more than once — never repeat the same expression
- Group resources by service area into named files: `networking.tf`, `storage.tf`, `compute.tf`, etc.
- `main.tf` in a module contains only the primary resources; supporting resources (role assignments, diagnostic settings) go in `iam.tf` and `monitoring.tf`
- No inline `provisioner` blocks — use cloud-init, Azure custom script extension, or Azure DevOps pipelines
- Mark sensitive outputs with `sensitive = true`

---

## Managed Identity Permissions

Every resource with a managed identity that accesses another Azure resource MUST have `azurerm_role_assignment` resources wiring them together. **Never assume a resource can access another without an explicit role assignment in Terraform.**

### When to add permissions

Add role assignments whenever:
- An app setting or Key Vault reference points to a Key Vault
- A Function App has a storage account (three roles always required for the runtime)
- An AKS cluster pulls images from a Container Registry
- SQL Server auditing writes to a Storage Account
- Any compute resource reads/writes data from Storage, Service Bus, or Event Hub

### How to generate them

Use `get_required_permissions` from the MCP server to get the exact HCL. Pass the consumer type/name and the target type/name. The tool returns ready-to-paste `azurerm_role_assignment` blocks.

Run `/tf-permissions` to audit an entire directory and generate all missing assignments at once.

### Common patterns

| Consumer | Target | Role(s) | Notes |
|---|---|---|---|
| App Service | Key Vault | `Key Vault Secrets User` | Required for Key Vault references in app settings |
| Function App | Storage Account | `Storage Blob Data Contributor` + `Storage Queue Data Contributor` + `Storage Table Data Contributor` | **All three required** for Functions runtime |
| Function App | Key Vault | `Key Vault Secrets User` | Required for Key Vault app setting references |
| AKS | Container Registry | `AcrPull` | **Use `kubelet_identity[0].object_id`** not `identity[0].principal_id` |
| AKS | VNet | `Network Contributor` | Required for Azure CNI |
| SQL Server | Storage Account | `Storage Blob Data Contributor` | Required for extended auditing and vulnerability assessment |
| Data Factory | Key Vault | `Key Vault Secrets User` | Required for linked service credentials |
| App Service / Function | Service Bus | `Azure Service Bus Data Sender/Receiver` | Use namespace scope |
| App Service / Function | Event Hub | `Azure Event Hubs Data Sender/Receiver` | Use namespace scope |

### SQL Server access (not RBAC)

SQL database access is **not** controlled via `azurerm_role_assignment`. Instead:
1. Add the managed identity to an Entra group
2. Grant the Entra group access in the database:
   ```sql
   CREATE USER [<entra-group-name>] FROM EXTERNAL PROVIDER;
   ALTER ROLE db_datareader ADD MEMBER [<entra-group-name>];
   ```

### Keep permissions in a dedicated file

Store all `azurerm_role_assignment` resources in `permissions.tf` — separate from the resource definitions. This makes it easy to audit access at a glance.

---

## MCP Server Usage

The `azure-tf-advisor` MCP server is available for all team members. Use its tools on every task:

| Tool | When to use |
|---|---|
| `get_secure_template` | When creating any new resource — get the secure baseline first |
| `validate_azure_naming` | Before finalising any resource name |
| `validate_required_tags` | After writing any resource block to verify tag compliance |
| `tfsec_scan` | After writing or editing Terraform files — fix CRITICAL/HIGH before finishing |
| `get_required_permissions` | Whenever a resource needs to access another — pass consumer type/name and target type/name to get exact role assignment HCL |

---

## Azure Policy Alignment

The following controls are enforced at the Azure platform level via Azure Policy. Your Terraform must not conflict with them:

- Storage accounts must use private endpoints (enforced via Deny policy)
- Key Vaults must have purge protection enabled (enforced)
- SQL servers must have Entra-only authentication (enforced in prod)
- All resources must have the required tags (enforced via Modify policy)
- Allowed regions: `uksouth`, `ukwest` only

If your code would be blocked by a Deny policy, resolve it in Terraform — do not request a policy exemption unless there is a documented architectural exception.
