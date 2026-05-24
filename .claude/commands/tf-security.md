# tf-security

Run a security-focused audit of the Terraform code in the current directory (or a specified path). Goes deeper than /tf-review — focused entirely on risk.

## Steps

1. Run `tfsec_scan` via the `azure-tf-advisor` MCP server. Show the raw output first, then analyse it.

2. Scan all `.tf` files for hardcoded secrets using these patterns (flag any literal string values, not references):
   - `password\s*=\s*"[^$]`
   - `secret\s*=\s*"[^$]`
   - `api_key\s*=\s*"[^$]`
   - `access_key\s*=\s*"[^$]`
   - `connection_string\s*=\s*"[^$]`
   - `client_secret\s*=\s*"`

3. Check **network exposure** for each resource:
   - Any resource with `public_network_access_enabled = true` — document and flag unless there is a justifying comment
   - Any storage account without `network_rules { default_action = "Deny" }`
   - Any NSG rule with `destination_port_range = "*"` and `source_address_prefix = "*"` or `"Internet"`
   - Any resource with a public IP that lacks a justification comment

4. Check **identity and access**:
   - Compute resources missing managed identity
   - Key Vaults using access policies instead of RBAC (`enable_rbac_authorization = false` or absent)
   - Storage accounts with `shared_access_key_enabled = true`
   - SQL servers missing `azuread_administrator` block

5. Check **data protection**:
   - Storage accounts with `allow_nested_items_to_be_public = true`
   - Key Vaults with `purge_protection_enabled = false`
   - Databases without TDE (check `transparent_data_encryption_enabled`)
   - Missing `azurerm_monitor_diagnostic_setting` on stateful resources

6. Produce the final report:

```
## Security Audit: <path>

### Risk Summary
| Severity | Count |
|---|---|
| 🔴 Critical | N |
| 🟠 High | N |
| 🟡 Medium | N |
| 🔵 Low | N |

### Findings

[For each finding:]
**[SEVERITY] Resource: <resource_type.name>**
- Issue: ...
- Risk: ...
- Fix:
  ```hcl
  <exact remediation code>
  ```

### Azure Policy Recommendations
Controls that should be enforced at the platform level to prevent these issues:
- ...
```

7. After the report, offer to automatically apply the fixes interactively (ask before editing each file).
