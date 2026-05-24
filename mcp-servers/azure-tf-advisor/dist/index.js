import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
const NAMING_RULES = {
    azurerm_resource_group: {
        prefix: "rg",
        maxLen: 90,
        allowHyphens: true,
        pattern: /^rg-[a-z0-9][a-z0-9-]{1,86}[a-z0-9]$/,
        description: "rg-<workload>-<env>-<region>-<instance>",
    },
    azurerm_virtual_network: {
        prefix: "vnet",
        maxLen: 64,
        allowHyphens: true,
        pattern: /^vnet-[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/,
        description: "vnet-<workload>-<env>-<region>-<instance>",
    },
    azurerm_subnet: {
        prefix: "snet",
        maxLen: 80,
        allowHyphens: true,
        pattern: /^snet-[a-z0-9][a-z0-9-]{1,74}[a-z0-9]$/,
        description: "snet-<tier>-<env>-<region>-<instance>",
    },
    azurerm_network_security_group: {
        prefix: "nsg",
        maxLen: 80,
        allowHyphens: true,
        pattern: /^nsg-[a-z0-9][a-z0-9-]{1,75}[a-z0-9]$/,
        description: "nsg-<workload>-<env>-<region>-<instance>",
    },
    azurerm_storage_account: {
        prefix: "st",
        maxLen: 24,
        minLen: 3,
        allowHyphens: false,
        pattern: /^st[a-z0-9]{1,22}$/,
        description: "st<workload><env><region><instance> (no hyphens, lowercase alphanumeric only)",
    },
    azurerm_key_vault: {
        prefix: "kv",
        maxLen: 24,
        minLen: 3,
        allowHyphens: true,
        pattern: /^kv-[a-z0-9][a-z0-9-]{0,18}[a-z0-9]$/,
        description: "kv-<workload>-<env>-<region> (max 24 chars)",
    },
    azurerm_kubernetes_cluster: {
        prefix: "aks",
        maxLen: 63,
        allowHyphens: true,
        pattern: /^aks-[a-z0-9][a-z0-9-]{1,57}[a-z0-9]$/,
        description: "aks-<workload>-<env>-<region>-<instance>",
    },
    azurerm_app_service_plan: {
        prefix: "asp",
        maxLen: 40,
        allowHyphens: true,
        pattern: /^asp-[a-z0-9][a-z0-9-]{1,34}[a-z0-9]$/,
        description: "asp-<workload>-<env>-<region>-<instance>",
    },
    azurerm_linux_web_app: {
        prefix: "app",
        maxLen: 60,
        allowHyphens: true,
        pattern: /^app-[a-z0-9][a-z0-9-]{1,54}[a-z0-9]$/,
        description: "app-<workload>-<env>-<region>-<instance>",
    },
    azurerm_windows_web_app: {
        prefix: "app",
        maxLen: 60,
        allowHyphens: true,
        pattern: /^app-[a-z0-9][a-z0-9-]{1,54}[a-z0-9]$/,
        description: "app-<workload>-<env>-<region>-<instance>",
    },
    azurerm_mssql_server: {
        prefix: "sql",
        maxLen: 63,
        allowHyphens: true,
        pattern: /^sql-[a-z0-9][a-z0-9-]{1,57}[a-z0-9]$/,
        description: "sql-<workload>-<env>-<region>-<instance>",
    },
    azurerm_mssql_database: {
        prefix: "sqldb",
        maxLen: 128,
        allowHyphens: true,
        pattern: /^sqldb-[a-z0-9][a-z0-9-]{1,121}[a-z0-9]$/,
        description: "sqldb-<workload>-<env>-<region>-<instance>",
    },
    azurerm_container_registry: {
        prefix: "cr",
        maxLen: 50,
        minLen: 5,
        allowHyphens: false,
        pattern: /^cr[a-z0-9]{3,48}$/,
        description: "cr<workload><env><region><instance> (no hyphens, alphanumeric only)",
    },
    azurerm_log_analytics_workspace: {
        prefix: "log",
        maxLen: 63,
        allowHyphens: true,
        pattern: /^log-[a-z0-9][a-z0-9-]{1,57}[a-z0-9]$/,
        description: "log-<workload>-<env>-<region>-<instance>",
    },
    azurerm_user_assigned_identity: {
        prefix: "id",
        maxLen: 128,
        allowHyphens: true,
        pattern: /^id-[a-z0-9][a-z0-9-]{1,123}[a-z0-9]$/,
        description: "id-<workload>-<env>-<region>-<instance>",
    },
    azurerm_private_endpoint: {
        prefix: "pep",
        maxLen: 80,
        allowHyphens: true,
        pattern: /^pep-[a-z0-9][a-z0-9-]{1,74}[a-z0-9]$/,
        description: "pep-<workload>-<env>-<region>-<instance>",
    },
    azurerm_linux_virtual_machine: {
        prefix: "vm",
        maxLen: 64,
        allowHyphens: true,
        pattern: /^vm-[a-z0-9][a-z0-9-]{1,59}[a-z0-9]$/,
        description: "vm-<workload>-<env>-<region>-<instance> (max 15 chars for Windows)",
    },
    azurerm_windows_virtual_machine: {
        prefix: "vm",
        maxLen: 15,
        allowHyphens: true,
        pattern: /^vm-[a-z0-9][a-z0-9-]{1,10}[a-z0-9]$/,
        description: "vm-<workload>-<env>-<instance> (max 15 chars for Windows VMs)",
    },
};
// ─── Secure Templates ─────────────────────────────────────────────────────────
const SECURE_TEMPLATES = {
    azurerm_storage_account: `resource "azurerm_storage_account" "this" {
  name                            = var.name
  resource_group_name             = var.resource_group_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "GRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false

  blob_properties {
    delete_retention_policy {
      days = 7
    }
    container_delete_retention_policy {
      days = 7
    }
    versioning_enabled = true
  }

  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    virtual_network_subnet_ids = var.subnet_ids
  }

  identity {
    type = "SystemAssigned"
  }

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}

resource "azurerm_monitor_diagnostic_setting" "storage" {
  name                       = "diag-\${var.name}"
  target_resource_id         = azurerm_storage_account.this.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  metric {
    category = "Transaction"
  }
}`,
    azurerm_key_vault: `resource "azurerm_key_vault" "this" {
  name                       = var.name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 90
  purge_protection_enabled   = true
  enable_rbac_authorization  = true

  network_acls {
    default_action             = "Deny"
    bypass                     = "AzureServices"
    virtual_network_subnet_ids = var.subnet_ids
    ip_rules                   = var.allowed_ip_ranges
  }

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}

resource "azurerm_monitor_diagnostic_setting" "keyvault" {
  name                       = "diag-\${var.name}"
  target_resource_id         = azurerm_key_vault.this.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "AuditEvent"
  }
  metric {
    category = "AllMetrics"
  }
}`,
    azurerm_kubernetes_cluster: `resource "azurerm_kubernetes_cluster" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  dns_prefix          = var.dns_prefix
  kubernetes_version  = var.kubernetes_version

  private_cluster_enabled             = true
  role_based_access_control_enabled   = true
  local_account_disabled              = true

  default_node_pool {
    name                = "system"
    node_count          = var.system_node_count
    vm_size             = var.system_vm_size
    vnet_subnet_id      = var.subnet_id
    os_disk_size_gb     = 128
    os_disk_type        = "Managed"
    only_critical_addons_enabled = true
  }

  identity {
    type = "SystemAssigned"
  }

  azure_active_directory_role_based_access_control {
    azure_rbac_enabled = true
    tenant_id          = var.tenant_id
  }

  network_profile {
    network_plugin    = "azure"
    network_policy    = "azure"
    load_balancer_sku = "standard"
    outbound_type     = "userDefinedRouting"
  }

  oms_agent {
    log_analytics_workspace_id      = var.log_analytics_workspace_id
    msi_auth_for_monitoring_enabled = true
  }

  microsoft_defender {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}`,
    azurerm_linux_web_app: `resource "azurerm_linux_web_app" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = var.service_plan_id
  https_only          = true

  site_config {
    minimum_tls_version = "1.2"
    ftps_state          = "Disabled"
    http2_enabled       = true

    application_stack {
      # Set to your runtime, e.g.:
      # node_version = "18-lts"
      # dotnet_version = "7.0"
      # python_version = "3.11"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
  }

  logs {
    detailed_error_messages = true
    failed_request_tracing  = true
    http_logs {
      retention_in_days = 7
    }
  }

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}

resource "azurerm_monitor_diagnostic_setting" "app" {
  name                       = "diag-\${var.name}"
  target_resource_id         = azurerm_linux_web_app.this.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "AppServiceHTTPLogs"
  }
  enabled_log {
    category = "AppServiceConsoleLogs"
  }
  metric {
    category = "AllMetrics"
  }
}`,
    azurerm_mssql_server: `resource "azurerm_mssql_server" "this" {
  name                          = var.name
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false

  azuread_administrator {
    login_username              = var.sql_admin_group_name
    object_id                   = var.sql_admin_group_object_id
    azuread_authentication_only = true
  }

  identity {
    type = "SystemAssigned"
  }

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}

resource "azurerm_mssql_server_extended_auditing_policy" "this" {
  server_id                               = azurerm_mssql_server.this.id
  log_monitoring_enabled                  = true
  retention_in_days                       = 90
}

resource "azurerm_mssql_server_security_alert_policy" "this" {
  resource_group_name = var.resource_group_name
  server_name         = azurerm_mssql_server.this.name
  state               = "Enabled"
  email_addresses     = var.security_alert_emails
}

resource "azurerm_mssql_server_vulnerability_assessment" "this" {
  server_security_alert_policy_id = azurerm_mssql_server_security_alert_policy.this.id
  storage_container_path          = var.vulnerability_assessment_storage_path
  storage_account_access_key      = var.vulnerability_assessment_storage_key

  recurring_scans {
    enabled                   = true
    email_subscription_admins = true
    emails                    = var.security_alert_emails
  }
}`,
    azurerm_virtual_network: `resource "azurerm_virtual_network" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = var.address_space

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}

resource "azurerm_subnet" "subnets" {
  for_each = var.subnets

  name                 = each.key
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [each.value.address_prefix]
}

resource "azurerm_network_security_group" "subnets" {
  for_each = var.subnets

  name                = "nsg-\${each.key}"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}

resource "azurerm_subnet_network_security_group_association" "subnets" {
  for_each = var.subnets

  subnet_id                 = azurerm_subnet.subnets[each.key].id
  network_security_group_id = azurerm_network_security_group.subnets[each.key].id
}

resource "azurerm_monitor_diagnostic_setting" "nsg" {
  for_each = var.subnets

  name                       = "diag-nsg-\${each.key}"
  target_resource_id         = azurerm_network_security_group.subnets[each.key].id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "NetworkSecurityGroupEvent"
  }
  enabled_log {
    category = "NetworkSecurityGroupRuleCounter"
  }
}`,
    azurerm_container_registry: `resource "azurerm_container_registry" "this" {
  name                          = var.name
  resource_group_name           = var.resource_group_name
  location                      = var.location
  sku                           = "Premium"
  admin_enabled                 = false
  public_network_access_enabled = false
  zone_redundancy_enabled       = true

  network_rule_set {
    default_action = "Deny"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = merge(var.tags, {
    managed_by = "terraform"
  })
}

resource "azurerm_monitor_diagnostic_setting" "acr" {
  name                       = "diag-\${var.name}"
  target_resource_id         = azurerm_container_registry.this.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "ContainerRegistryRepositoryEvents"
  }
  enabled_log {
    category = "ContainerRegistryLoginEvents"
  }
  metric {
    category = "AllMetrics"
  }
}`,
};
// ─── Required Tags ────────────────────────────────────────────────────────────
const REQUIRED_TAG_KEYS = ["environment", "project", "cost_center", "owner"];
const VALID_ENVIRONMENTS = ["dev", "staging", "prod"];
// ─── Server ───────────────────────────────────────────────────────────────────
const server = new Server({ name: "azure-tf-advisor", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "validate_azure_naming",
            description: "Validate an Azure resource name against Microsoft CAF naming conventions. Returns pass/fail with the correct format if it fails.",
            inputSchema: {
                type: "object",
                properties: {
                    resource_type: {
                        type: "string",
                        description: "Terraform resource type (e.g. azurerm_storage_account)",
                    },
                    name: {
                        type: "string",
                        description: "The proposed resource name to validate",
                    },
                },
                required: ["resource_type", "name"],
            },
        },
        {
            name: "validate_required_tags",
            description: "Check that a tags object contains all required team tags and that the environment value is valid.",
            inputSchema: {
                type: "object",
                properties: {
                    tags: {
                        type: "object",
                        description: "Key-value tag object to validate",
                        additionalProperties: { type: "string" },
                    },
                },
                required: ["tags"],
            },
        },
        {
            name: "tfsec_scan",
            description: "Run tfsec static analysis on a directory and return all findings. Returns an error message if tfsec is not installed.",
            inputSchema: {
                type: "object",
                properties: {
                    directory: {
                        type: "string",
                        description: "Absolute or relative path to the Terraform directory to scan",
                    },
                    minimum_severity: {
                        type: "string",
                        enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
                        description: "Minimum severity to report (default: MEDIUM)",
                    },
                },
                required: ["directory"],
            },
        },
        {
            name: "get_secure_template",
            description: "Get a secure, team-standard HCL template for an Azure resource type. Use this as the starting point when creating any new resource.",
            inputSchema: {
                type: "object",
                properties: {
                    resource_type: {
                        type: "string",
                        description: "Terraform resource type (e.g. azurerm_storage_account)",
                    },
                },
                required: ["resource_type"],
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case "validate_azure_naming":
            return handleValidateNaming(args);
        case "validate_required_tags":
            return handleValidateTags(args);
        case "tfsec_scan":
            return handleTfsecScan(args);
        case "get_secure_template":
            return handleGetTemplate(args);
        default:
            return {
                content: [{ type: "text", text: `Unknown tool: ${name}` }],
                isError: true,
            };
    }
});
// ─── Handlers ─────────────────────────────────────────────────────────────────
function handleValidateNaming(args) {
    const rule = NAMING_RULES[args.resource_type];
    if (!rule) {
        const known = Object.keys(NAMING_RULES).join(", ");
        return {
            content: [
                {
                    type: "text",
                    text: `No naming rule found for "${args.resource_type}". Known types: ${known}`,
                },
            ],
        };
    }
    const issues = [];
    if (args.name.length > rule.maxLen) {
        issues.push(`Name too long: ${args.name.length} chars (max ${rule.maxLen})`);
    }
    if (rule.minLen && args.name.length < rule.minLen) {
        issues.push(`Name too short: ${args.name.length} chars (min ${rule.minLen})`);
    }
    if (!rule.allowHyphens && args.name.includes("-")) {
        issues.push(`Hyphens not allowed in ${args.resource_type} names`);
    }
    if (!args.name.startsWith(rule.prefix)) {
        issues.push(`Must start with prefix "${rule.prefix}"`);
    }
    if (!rule.pattern.test(args.name)) {
        issues.push(`Does not match expected pattern: ${rule.description}`);
    }
    if (args.name !== args.name.toLowerCase()) {
        issues.push("Name must be lowercase");
    }
    if (issues.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `✅ "${args.name}" is valid for ${args.resource_type}\nPattern: ${rule.description}`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `❌ "${args.name}" is invalid for ${args.resource_type}:\n${issues.map((i) => `  - ${i}`).join("\n")}\n\nExpected pattern: ${rule.description}\nExample: ${rule.description.replace(/<[^>]+>/g, (m) => m.slice(1, -1).split("-")[0])}`,
            },
        ],
    };
}
function handleValidateTags(args) {
    const issues = [];
    const presentKeys = Object.keys(args.tags).map((k) => k.toLowerCase());
    for (const required of REQUIRED_TAG_KEYS) {
        if (!presentKeys.includes(required)) {
            issues.push(`Missing required tag: "${required}"`);
        }
    }
    const env = args.tags["environment"] ?? args.tags["Environment"];
    if (env && !VALID_ENVIRONMENTS.includes(env)) {
        issues.push(`"environment" tag must be one of: ${VALID_ENVIRONMENTS.join(", ")} (got "${env}")`);
    }
    if (!args.tags["managed_by"] && !args.tags["ManagedBy"]) {
        issues.push('Missing "managed_by" tag — should be set to "terraform"');
    }
    if (issues.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `✅ Tags valid. Present: ${Object.keys(args.tags).join(", ")}`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `❌ Tag validation failed:\n${issues.map((i) => `  - ${i}`).join("\n")}\n\nRequired tags: ${REQUIRED_TAG_KEYS.join(", ")}, managed_by`,
            },
        ],
    };
}
function handleTfsecScan(args) {
    const severity = args.minimum_severity ?? "MEDIUM";
    const isWindows = process.platform === "win32";
    try {
        execSync(isWindows ? "where tfsec" : "which tfsec", { stdio: "pipe" });
    }
    catch {
        const installHint = isWindows
            ? "Windows:\n  winget install aquasecurity.tfsec\n  scoop install tfsec\n  choco install tfsec"
            : "macOS:  brew install tfsec\nLinux:  curl -s https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh | bash";
        return {
            content: [
                {
                    type: "text",
                    text: `tfsec is not installed.\n\n${installHint}`,
                },
            ],
            isError: true,
        };
    }
    try {
        const output = execSync(`tfsec "${args.directory}" --format=text --no-colour --minimum-severity=${severity} 2>&1`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
        return {
            content: [
                {
                    type: "text",
                    text: output || `✅ No findings at ${severity}+ severity in ${args.directory}`,
                },
            ],
        };
    }
    catch (err) {
        const error = err;
        const output = error.stdout ?? error.stderr ?? error.message ?? String(err);
        return {
            content: [{ type: "text", text: output }],
        };
    }
}
function handleGetTemplate(args) {
    const template = SECURE_TEMPLATES[args.resource_type];
    if (!template) {
        const available = Object.keys(SECURE_TEMPLATES).join(", ");
        return {
            content: [
                {
                    type: "text",
                    text: `No secure template for "${args.resource_type}".\n\nAvailable templates: ${available}\n\nFor unlisted resources, apply the security requirements from CLAUDE.md for the relevant service category.`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `Secure template for ${args.resource_type}:\n\n\`\`\`hcl\n${template}\n\`\`\`\n\nThis template follows team security standards. Review all variables and adjust for your specific use case. Run validate_azure_naming on the name and validate_required_tags on the tags block before finalising.`,
            },
        ],
    };
}
// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map