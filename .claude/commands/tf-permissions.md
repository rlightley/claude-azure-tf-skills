# tf-permissions

Analyse the Terraform code in the current directory and generate all missing `azurerm_role_assignment` resources needed for managed identity access between resources.

This command exists to solve the "permission whack-a-mole" problem — CI/CD pipelines failing with auth errors one at a time. Run this after writing resources and before deploying.

## Steps

1. Read all `.tf` files in the current directory (and `modules/` if present).

2. Build a map of all resources that act as **consumers** (have managed identities):
   - `azurerm_linux_web_app`, `azurerm_windows_web_app`
   - `azurerm_linux_function_app`, `azurerm_windows_function_app`
   - `azurerm_kubernetes_cluster`
   - `azurerm_mssql_server`
   - `azurerm_data_factory`
   - `azurerm_container_registry`
   - `azurerm_linux_virtual_machine`, `azurerm_windows_virtual_machine`
   - `azurerm_user_assigned_identity`

3. Build a map of all resources that act as **targets** (things being accessed):
   - `azurerm_key_vault`
   - `azurerm_storage_account`
   - `azurerm_servicebus_namespace`
   - `azurerm_eventhub_namespace`
   - `azurerm_container_registry`
   - `azurerm_virtual_network`
   - `azurerm_mssql_server`

4. For every consumer–target pairing that exists in the same codebase, call `get_required_permissions` from the `azure-tf-advisor` MCP server to get the role assignments. Infer `access_level`:
   - If the consumer reads config/secrets from the target → `read`
   - If the consumer writes data to the target → `write`
   - If unclear → default to `read` and note that `write` may also be needed
   - For Function Apps → Storage Account: always `write` (runtime requirement)
   - For SQL Server → Storage Account: always `write` (auditing)

5. Cross-check against `azurerm_role_assignment` resources already present in the codebase. Only include assignments that are **missing**.

6. If there are missing assignments, write them to a file called `permissions.tf` in the current directory, grouped by consumer resource with a comment header per group.

7. Print a summary:

```
## Permissions Audit

### Already present
- azurerm_linux_web_app.api → azurerm_key_vault.secrets: Key Vault Secrets User ✅

### Generated (written to permissions.tf)
- azurerm_linux_function_app.processor → azurerm_storage_account.data: 3 roles ⚠️ REQUIRED

### Requires manual action
- azurerm_linux_web_app.api → azurerm_mssql_server.db: SQL access uses Entra group membership, not RBAC.
  Add the managed identity to an Entra group, then run the following in the database:
  CREATE USER [<mi-name>] FROM EXTERNAL PROVIDER;
  ALTER ROLE db_datareader ADD MEMBER [<mi-name>];
```

8. After writing `permissions.tf`, validate all resource names in it with `validate_azure_naming` and run `tfsec_scan` on the directory.

## Notes

- Place `permissions.tf` alongside the other `.tf` files — keep it separate so it is easy to review.
- For AKS → ACR: use `kubelet_identity[0].object_id`, not `identity[0].principal_id` — the tool handles this, but flag it clearly in the output.
- If the consumer uses a user-assigned identity instead of a system-assigned identity, note that the `principal_id` reference may need adjusting.
