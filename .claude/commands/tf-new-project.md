# tf-new-project

Scaffold a new Azure Terraform project following team standards from CLAUDE.md.

## Steps

1. Ask the user for the following (in a single message, not one at a time):
   - **Project name** — short kebab-case identifier used in resource naming (e.g. `payments`, `platform`)
   - **Environments** to scaffold — default: dev, staging, prod
   - **Primary Azure region** — default: `uksouth`
   - **Modules to include** — let them choose from: `networking`, `storage`, `key_vault`, `aks`, `app_service`, `sql`

2. Before generating any resource code, call `get_secure_template` from the `azure-tf-advisor` MCP server for each selected module type to get the secure baseline.

3. Create the full directory structure as defined in CLAUDE.md:
   ```
   <project-name>/
   ├── modules/<module-name>/{main.tf, variables.tf, outputs.tf, versions.tf, README.md}
   ├── environments/{dev,staging,prod}/{main.tf, variables.tf, terraform.tfvars.example, outputs.tf, backend.tf}
   ├── .tfsec/config.yml
   ├── .terraform.lock.hcl  (empty placeholder)
   └── .gitignore
   ```

4. Populate every file with secure defaults:
   - All resources must include the required tags pattern from CLAUDE.md
   - All security settings from CLAUDE.md must be present for each resource type
   - `backend.tf` must use the `azurerm` backend with environment-scoped state key
   - `versions.tf` must pin provider to `~> 3.100`

5. Validate all generated resource names with `validate_azure_naming` before writing them.

6. After all files are written, run `tfsec_scan` on the generated project directory and report any findings. Fix all CRITICAL and HIGH issues before completing.

7. Print a summary of what was created and the next steps (terraform init, configure backend credentials).

## .gitignore content to use

```
.terraform/
*.tfstate
*.tfstate.*
crash.log
crash.*.log
*.tfvars
!*.tfvars.example
override.tf
override.tf.json
*_override.tf
*_override.tf.json
.terraform.lock.hcl
!.terraform.lock.hcl
```

## .tfsec/config.yml content to use

```yaml
minimum_severity: MEDIUM
exclude:
  []
custom_checks:
  []
```
