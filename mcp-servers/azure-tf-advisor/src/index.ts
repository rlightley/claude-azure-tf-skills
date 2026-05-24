import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";

// ─── Naming Rules ────────────────────────────────────────────────────────────

interface NamingRule {
  prefix: string;
  maxLen: number;
  minLen?: number;
  allowHyphens: boolean;
  pattern: RegExp;
  description: string;
}

const NAMING_RULES: Record<string, NamingRule> = {
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

const SECURE_TEMPLATES: Record<string, string> = {
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

// ─── Permission Patterns ──────────────────────────────────────────────────────

interface RoleEntry {
  role: string;
  principalRef: string; // CONSUMER = Terraform resource name placeholder
  scopeRef: string;     // TARGET  = Terraform resource name placeholder
  description: string;
  required?: boolean;   // true = host/runtime will fail without this
}

interface PermissionPattern {
  read: RoleEntry[];
  write: RoleEntry[];
  notes?: string;
}

// Windows variants share patterns with their Linux counterparts
const CONSUMER_ALIASES: Record<string, string> = {
  azurerm_windows_web_app:       "azurerm_linux_web_app",
  azurerm_windows_function_app:  "azurerm_linux_function_app",
  azurerm_windows_virtual_machine: "azurerm_linux_virtual_machine",
};

const PERMISSION_PATTERNS: Record<string, Record<string, PermissionPattern>> = {
  azurerm_linux_web_app: {
    azurerm_key_vault: {
      read: [{ role: "Key Vault Secrets User", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Read secrets referenced in app settings", required: true }],
      write: [{ role: "Key Vault Secrets Officer", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Create and update secrets" }],
    },
    azurerm_storage_account: {
      read: [{ role: "Storage Blob Data Reader", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read blobs from storage" }],
      write: [{ role: "Storage Blob Data Contributor", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read and write blobs" }],
    },
    azurerm_servicebus_namespace: {
      read: [{ role: "Azure Service Bus Data Receiver", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Receive messages from Service Bus" }],
      write: [
        { role: "Azure Service Bus Data Sender",   principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Send messages to Service Bus" },
        { role: "Azure Service Bus Data Receiver", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Receive messages from Service Bus" },
      ],
    },
    azurerm_eventhub_namespace: {
      read: [{ role: "Azure Event Hubs Data Receiver", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Receive events from Event Hub" }],
      write: [
        { role: "Azure Event Hubs Data Sender",   principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Send events" },
        { role: "Azure Event Hubs Data Receiver", principalRef: "azurerm_linux_web_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Receive events" },
      ],
    },
    azurerm_mssql_server: {
      read: [],
      write: [],
      notes: "SQL Server access is not controlled via Azure RBAC role assignments. Instead, create an Entra group, add the app's managed identity to it, then run: CREATE USER [<mi-name>] FROM EXTERNAL PROVIDER; ALTER ROLE db_datareader ADD MEMBER [<mi-name>];",
    },
  },

  azurerm_linux_function_app: {
    azurerm_storage_account: {
      read: [
        { role: "Storage Blob Data Contributor",  principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Functions runtime: blob triggers and durable state", required: true },
        { role: "Storage Queue Data Contributor", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Functions runtime: queue triggers and scale controller", required: true },
        { role: "Storage Table Data Contributor", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Functions runtime: durable functions state store", required: true },
      ],
      write: [
        { role: "Storage Blob Data Contributor",  principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Functions runtime (required)", required: true },
        { role: "Storage Queue Data Contributor", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Functions runtime (required)", required: true },
        { role: "Storage Table Data Contributor", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Functions runtime (required)", required: true },
      ],
      notes: "All three storage roles are REQUIRED when using managed identity for the Functions storage account. Missing any one will prevent the function host from starting.",
    },
    azurerm_key_vault: {
      read: [{ role: "Key Vault Secrets User", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Read secrets used in app settings / Key Vault references", required: true }],
      write: [{ role: "Key Vault Secrets Officer", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Create and update secrets" }],
    },
    azurerm_servicebus_namespace: {
      read: [{ role: "Azure Service Bus Data Receiver", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Service Bus trigger binding" }],
      write: [
        { role: "Azure Service Bus Data Sender",   principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Send output binding" },
        { role: "Azure Service Bus Data Receiver", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Receive trigger binding" },
      ],
    },
    azurerm_eventhub_namespace: {
      read: [{ role: "Azure Event Hubs Data Receiver", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Event Hub trigger binding" }],
      write: [
        { role: "Azure Event Hubs Data Sender",   principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Send output binding" },
        { role: "Azure Event Hubs Data Receiver", principalRef: "azurerm_linux_function_app.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Receive trigger binding" },
      ],
    },
  },

  azurerm_kubernetes_cluster: {
    azurerm_container_registry: {
      read: [{ role: "AcrPull", principalRef: "azurerm_kubernetes_cluster.CONSUMER.kubelet_identity[0].object_id", scopeRef: "azurerm_container_registry.TARGET.id", description: "Pull images from ACR (assigned to kubelet identity, not cluster identity)", required: true }],
      write: [{ role: "AcrPush", principalRef: "azurerm_kubernetes_cluster.CONSUMER.kubelet_identity[0].object_id", scopeRef: "azurerm_container_registry.TARGET.id", description: "Push and pull images" }],
      notes: "Always use kubelet_identity[0].object_id — NOT identity[0].principal_id. The kubelet is what pulls images on each node. Using the wrong identity is a very common mistake.",
    },
    azurerm_virtual_network: {
      read: [{ role: "Network Contributor", principalRef: "azurerm_kubernetes_cluster.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_virtual_network.TARGET.id", description: "Azure CNI: manage IP allocations in the VNet", required: true }],
      write: [{ role: "Network Contributor", principalRef: "azurerm_kubernetes_cluster.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_virtual_network.TARGET.id", description: "Azure CNI networking", required: true }],
      notes: "For least privilege, scope to the subnet instead: azurerm_subnet.TARGET.id",
    },
    azurerm_key_vault: {
      read: [{ role: "Key Vault Secrets User", principalRef: "azurerm_kubernetes_cluster.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "CSI Secret Store driver: mount secrets as volumes", required: true }],
      write: [{ role: "Key Vault Secrets Officer", principalRef: "azurerm_kubernetes_cluster.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Write secrets via workload identity" }],
      notes: "For workload identity scenarios, assign the role to the pod's user-assigned identity instead of the cluster identity.",
    },
  },

  azurerm_mssql_server: {
    azurerm_storage_account: {
      read: [{ role: "Storage Blob Data Contributor", principalRef: "azurerm_mssql_server.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Write audit logs and vulnerability assessment results to blob storage", required: true }],
      write: [{ role: "Storage Blob Data Contributor", principalRef: "azurerm_mssql_server.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Write audit logs and VA results", required: true }],
      notes: "Required when azurerm_mssql_server_extended_auditing_policy or azurerm_mssql_server_vulnerability_assessment target a storage account.",
    },
  },

  azurerm_data_factory: {
    azurerm_key_vault: {
      read: [{ role: "Key Vault Secrets User", principalRef: "azurerm_data_factory.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Read secrets used in linked service connections", required: true }],
      write: [{ role: "Key Vault Secrets Officer", principalRef: "azurerm_data_factory.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Create and update secrets" }],
    },
    azurerm_storage_account: {
      read: [{ role: "Storage Blob Data Reader", principalRef: "azurerm_data_factory.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read data from source datasets" }],
      write: [{ role: "Storage Blob Data Contributor", principalRef: "azurerm_data_factory.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read and write data for sink datasets" }],
    },
  },

  azurerm_container_registry: {
    azurerm_key_vault: {
      read: [{ role: "Key Vault Crypto Service Encryption User", principalRef: "azurerm_container_registry.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Customer-managed key (CMK) encryption — requires Premium SKU", required: true }],
      write: [{ role: "Key Vault Crypto Service Encryption User", principalRef: "azurerm_container_registry.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "CMK encryption", required: true }],
      notes: "Use a user-assigned identity to avoid a circular dependency between the registry and the key vault. Assign the role before creating the registry.",
    },
  },

  azurerm_linux_virtual_machine: {
    azurerm_key_vault: {
      read: [{ role: "Key Vault Secrets User", principalRef: "azurerm_linux_virtual_machine.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Read secrets from Key Vault via VM extension or application code" }],
      write: [{ role: "Key Vault Secrets Officer", principalRef: "azurerm_linux_virtual_machine.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Create and update secrets" }],
    },
    azurerm_storage_account: {
      read: [{ role: "Storage Blob Data Reader", principalRef: "azurerm_linux_virtual_machine.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read blobs" }],
      write: [{ role: "Storage Blob Data Contributor", principalRef: "azurerm_linux_virtual_machine.CONSUMER.identity[0].principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read and write blobs" }],
    },
  },

  azurerm_user_assigned_identity: {
    azurerm_key_vault: {
      read: [{ role: "Key Vault Secrets User", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Read secrets — attach this identity to the resource needing access" }],
      write: [{ role: "Key Vault Secrets Officer", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_key_vault.TARGET.id", description: "Create and update secrets" }],
    },
    azurerm_storage_account: {
      read: [{ role: "Storage Blob Data Reader", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read blobs" }],
      write: [{ role: "Storage Blob Data Contributor", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_storage_account.TARGET.id", description: "Read and write blobs" }],
    },
    azurerm_container_registry: {
      read: [{ role: "AcrPull", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_container_registry.TARGET.id", description: "Pull images — use for AKS workload identity or CI pipelines" }],
      write: [{ role: "AcrPush", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_container_registry.TARGET.id", description: "Push and pull images" }],
    },
    azurerm_eventhub_namespace: {
      read: [{ role: "Azure Event Hubs Data Receiver", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Receive events" }],
      write: [
        { role: "Azure Event Hubs Data Sender",   principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Send events" },
        { role: "Azure Event Hubs Data Receiver", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_eventhub_namespace.TARGET.id", description: "Receive events" },
      ],
    },
    azurerm_servicebus_namespace: {
      read: [{ role: "Azure Service Bus Data Receiver", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Receive messages" }],
      write: [
        { role: "Azure Service Bus Data Sender",   principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Send messages" },
        { role: "Azure Service Bus Data Receiver", principalRef: "azurerm_user_assigned_identity.CONSUMER.principal_id", scopeRef: "azurerm_servicebus_namespace.TARGET.id", description: "Receive messages" },
      ],
    },
  },
};

// ─── Required Tags ────────────────────────────────────────────────────────────

const REQUIRED_TAG_KEYS = ["environment", "project", "cost_center", "owner"];
const VALID_ENVIRONMENTS = ["dev", "staging", "prod"];

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "azure-tf-advisor", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "validate_azure_naming",
      description:
        "Validate an Azure resource name against Microsoft CAF naming conventions. Returns pass/fail with the correct format if it fails.",
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
      description:
        "Check that a tags object contains all required team tags and that the environment value is valid.",
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
      description:
        "Run tfsec static analysis on a directory and return all findings. Returns an error message if tfsec is not installed.",
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
      description:
        "Get a secure, team-standard HCL template for an Azure resource type. Use this as the starting point when creating any new resource.",
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
    {
      name: "get_required_permissions",
      description:
        "Return the exact azurerm_role_assignment HCL needed for one Azure resource to access another using managed identity. Covers App Service, Function Apps, AKS, SQL Server, Data Factory, Container Registry, VMs, and user-assigned identities.",
      inputSchema: {
        type: "object",
        properties: {
          consumer_type: {
            type: "string",
            description: "Terraform type of the resource that needs access (e.g. azurerm_linux_web_app)",
          },
          consumer_name: {
            type: "string",
            description: "Terraform resource name of the consumer as it appears in the resource block (e.g. 'api')",
          },
          target_type: {
            type: "string",
            description: "Terraform type of the resource being accessed (e.g. azurerm_key_vault)",
          },
          target_name: {
            type: "string",
            description: "Terraform resource name of the target as it appears in the resource block (e.g. 'app_secrets')",
          },
          access_level: {
            type: "string",
            enum: ["read", "write"],
            description: "Access level required. Defaults to 'read' (least privilege). Use 'write' when the consumer needs to create or modify data.",
          },
        },
        required: ["consumer_type", "consumer_name", "target_type", "target_name"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "validate_azure_naming":
      return handleValidateNaming(args as { resource_type: string; name: string });

    case "validate_required_tags":
      return handleValidateTags(args as { tags: Record<string, string> });

    case "tfsec_scan":
      return handleTfsecScan(
        args as { directory: string; minimum_severity?: string }
      );

    case "get_secure_template":
      return handleGetTemplate(args as { resource_type: string });

    case "get_required_permissions":
      return handleGetRequiredPermissions(
        args as {
          consumer_type: string;
          consumer_name: string;
          target_type: string;
          target_name: string;
          access_level?: "read" | "write";
        }
      );

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleValidateNaming(args: { resource_type: string; name: string }) {
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

  const issues: string[] = [];

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

function handleValidateTags(args: { tags: Record<string, string> }) {
  const issues: string[] = [];
  const presentKeys = Object.keys(args.tags).map((k) => k.toLowerCase());

  for (const required of REQUIRED_TAG_KEYS) {
    if (!presentKeys.includes(required)) {
      issues.push(`Missing required tag: "${required}"`);
    }
  }

  const env = args.tags["environment"] ?? args.tags["Environment"];
  if (env && !VALID_ENVIRONMENTS.includes(env)) {
    issues.push(
      `"environment" tag must be one of: ${VALID_ENVIRONMENTS.join(", ")} (got "${env}")`
    );
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

function handleTfsecScan(args: { directory: string; minimum_severity?: string }) {
  const severity = args.minimum_severity ?? "MEDIUM";
  const isWindows = process.platform === "win32";

  try {
    execSync(isWindows ? "where tfsec" : "which tfsec", { stdio: "pipe" });
  } catch {
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
    const output = execSync(
      `tfsec "${args.directory}" --format=text --no-colour --minimum-severity=${severity} 2>&1`,
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );

    return {
      content: [
        {
          type: "text",
          text: output || `✅ No findings at ${severity}+ severity in ${args.directory}`,
        },
      ],
    };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = error.stdout ?? error.stderr ?? error.message ?? String(err);
    return {
      content: [{ type: "text", text: output }],
    };
  }
}

function handleGetTemplate(args: { resource_type: string }) {
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

function handleGetRequiredPermissions(args: {
  consumer_type: string;
  consumer_name: string;
  target_type: string;
  target_name: string;
  access_level?: "read" | "write";
}) {
  const canonicalConsumer = CONSUMER_ALIASES[args.consumer_type] ?? args.consumer_type;
  const consumerPatterns = PERMISSION_PATTERNS[canonicalConsumer];

  if (!consumerPatterns) {
    const supported = Object.keys(PERMISSION_PATTERNS).join(", ");
    return {
      content: [{
        type: "text",
        text: `No permission patterns for "${args.consumer_type}".\n\nSupported consumer types: ${supported}`,
      }],
    };
  }

  const pattern = consumerPatterns[args.target_type];

  if (!pattern) {
    const supported = Object.keys(consumerPatterns).join(", ");
    return {
      content: [{
        type: "text",
        text: `No permission patterns for "${args.consumer_type}" → "${args.target_type}".\n\nFor this consumer, supported target types: ${supported}`,
      }],
    };
  }

  const level = args.access_level ?? "read";
  const roles = pattern[level];

  if (roles.length === 0) {
    const notes = pattern.notes ? `\n\n${pattern.notes}` : "";
    return {
      content: [{
        type: "text",
        text: `No RBAC role assignments apply for "${args.consumer_type}" → "${args.target_type}" (${level}).${notes}`,
      }],
    };
  }

  const toSlug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const blocks = roles.map((entry) => {
    const resourceLabel = `${toSlug(args.consumer_name)}_${toSlug(args.target_name)}_${toSlug(entry.role)}`;
    const principal = entry.principalRef.replace(/CONSUMER/g, args.consumer_name);
    const scope = entry.scopeRef.replace(/TARGET/g, args.target_name);
    const requiredMarker = entry.required ? "  # REQUIRED — missing this will cause a runtime failure\n" : "";
    return `${requiredMarker}resource "azurerm_role_assignment" "${resourceLabel}" {\n  scope                = ${scope}\n  role_definition_name = "${entry.role}"\n  principal_id         = ${principal}\n  description          = "${entry.description}"\n}`;
  });

  const header = `# ${args.consumer_type}.${args.consumer_name} → ${args.target_type}.${args.target_name} (${level})`;
  const notesSection = pattern.notes ? `\n\n⚠️  ${pattern.notes}` : "";

  return {
    content: [{
      type: "text",
      text: `${header}\n\n\`\`\`hcl\n${blocks.join("\n\n")}\n\`\`\`${notesSection}`,
    }],
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
