# tf-new-module

Create a new reusable Terraform module following team standards from CLAUDE.md.

## Steps

1. Ask the user (in a single message):
   - **Module name** — snake_case (e.g. `storage_account`, `aks_cluster`, `sql_database`)
   - **Azure resources** the module will manage (list the `azurerm_*` resource types)
   - **Key input variables** the caller will need to provide

2. Call `get_secure_template` from the `azure-tf-advisor` MCP server for each resource type in the module.

3. Create the module at `modules/<module-name>/` with these files:

### main.tf
- All resource blocks using the secure templates from the MCP server
- Every resource includes `tags = merge(var.tags, { managed_by = "terraform" })`
- Compute resources include `identity { type = "SystemAssigned" }`
- Include a `azurerm_monitor_diagnostic_setting` resource for each primary resource

### variables.tf
- `var.name` — string, the base name (used to derive resource names)
- `var.resource_group_name` — string
- `var.location` — string, default `"uksouth"`
- `var.tags` — object type matching the required tags schema from CLAUDE.md, with the environment validation
- Any resource-specific variables with type constraints and descriptions
- No variable should lack a `description`

### outputs.tf
- Export `id`, `name`, and any connection-relevant attributes
- Mark secrets (connection strings, keys) as `sensitive = true`

### versions.tf
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

4. Validate all resource names with `validate_azure_naming` and tag structure with `validate_required_tags`.

5. After writing, run `tfsec_scan` on the module directory. Fix all CRITICAL and HIGH findings.

6. Print a usage example showing how to call the module from an environment's `main.tf`.
