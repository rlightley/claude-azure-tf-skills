# tf-review

Review Terraform code against team standards. Accepts an optional path argument; defaults to the current directory.

## Steps

1. Read all `.tf` files in the target directory (recursively if it contains a `modules/` subdirectory).

2. Check **project structure** against CLAUDE.md:
   - Required directory layout present
   - `versions.tf` exists in all modules
   - `.tfsec/config.yml` present
   - `.gitignore` excludes `*.tfstate`, `.terraform/`, and `*.tfvars`

3. For every resource block found, check **naming** using `validate_azure_naming` from the MCP server.

4. For every resource block found, check **tags** using `validate_required_tags` from the MCP server.

5. Check **security requirements** from CLAUDE.md for each service type present:
   - Storage accounts: https_only, TLS version, public access, network rules
   - Key Vaults: soft delete, purge protection, RBAC auth, network ACLs
   - AKS: private cluster (staging/prod), RBAC, network policy
   - App Services: https_only, TLS version, ftps disabled, managed identity
   - SQL: TLS version, public access disabled, Entra admin, audit policy
   - All VMs/compute: managed identity present
   - All subnets: NSG association present

6. Run `tfsec_scan` on the directory.

7. Check for hardcoded secrets by searching for patterns: `password =`, `secret =`, `key =`, `connection_string =` with literal string values (not variable or data source references).

8. Output findings using this format:

```
## Review Report: <path>

### Summary
| Severity | Count |
|---|---|
| 🔴 Critical | N |
| 🟠 High | N |
| 🟡 Medium | N |
| ✅ Passed | N |

### Findings

#### 🔴 Critical
- **[filename:line]** Description of issue and required fix

#### 🟠 High
...

#### 🟡 Medium
...

### Prioritised Fix List
1. ...
```

Severity definitions:
- 🔴 **Critical** — security vulnerability, hardcoded secret, or exposure to the internet
- 🟠 **High** — missing mandatory security control (managed identity, HTTPS, TLS), naming violation, missing required tags
- 🟡 **Medium** — best practice not followed, style issue, missing description on variable
