locals {
  manage_zone_shared = var.environment == "production"

  hosts = var.environment == "staging" ? {
    points  = "staging.points.freeism.app"
    markets = "staging.markets.freeism.app"
    } : {
    points  = "points.freeism.app"
    markets = "markets.freeism.app"
  }

  staging_hosts = var.environment == "staging" ? local.hosts : {}

  native_alerts = {
    runtime_incident = {
      alert_type = "incident_alert"
      filters = {
        affected_components = ["Workers"]
      }
    }
    edge_5xx = {
      alert_type = "http_alert_edge_error"
      filters = {
        zones = [var.zone_id]
      }
    }
    usage = {
      alert_type = "billing_usage_alert"
      filters = {
        product = ["Workers"]
        limit   = ["80"]
      }
    }
  }
}

removed {
  from = cloudflare_dns_record.apex

  lifecycle {
    destroy = false
  }
}

resource "cloudflare_dns_record" "www" {
  count = local.manage_zone_shared ? 1 : 0

  zone_id = var.zone_id
  name    = "www.freeism.app"
  type    = "A"
  content = "192.0.2.1"
  ttl     = 1
  proxied = true
  comment = "Terraform-owned redirect endpoint"
}

resource "cloudflare_ruleset" "root_redirect" {
  count = local.manage_zone_shared ? 1 : 0

  zone_id     = var.zone_id
  name        = "freeism-root-redirect"
  description = "Redirect www to the portal root"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [{
    ref         = "redirect_www_to_portal"
    description = "Discard source path and query"
    expression  = "http.host eq \"www.freeism.app\""
    action      = "redirect"
    action_parameters = {
      from_value = {
        status_code = 301
        target_url = {
          value = "https://freeism.app/"
        }
        preserve_query_string = false
      }
    }
  }]
}

resource "cloudflare_ruleset" "managed_waf" {
  count = local.manage_zone_shared ? 1 : 0

  zone_id     = var.zone_id
  name        = "freeism-managed-waf"
  description = "Execute the Cloudflare Managed Ruleset"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules = [{
    ref         = "execute_cloudflare_managed_ruleset"
    description = "Execute the Cloudflare Managed Ruleset"
    expression  = "true"
    action      = "execute"
    action_parameters = {
      id = "efb7b8c949ac4650a09736fc376e9aee"
    }
  }]
}

resource "cloudflare_ruleset" "edge_rate_limit" {
  count = local.manage_zone_shared ? 1 : 0

  zone_id     = var.zone_id
  name        = "freeism-edge-rate-limits"
  description = "Limits that can be decided from IP and request path at the edge"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [{
    ref         = "markets_websocket_upgrade_by_ip"
    description = "Limit Markets WebSocket upgrades to 30 per minute per IP"
    expression  = "starts_with(http.request.uri.path, \"/api/auctions/\") and ends_with(http.request.uri.path, \"/events\")"
    action      = "block"
    action_parameters = {
      response = {
        status_code  = 429
        content      = "{\"type\":\"about:blank\",\"title\":\"Too Many Requests\",\"status\":429}"
        content_type = "application/json"
      }
    }
    ratelimit = {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 30
      mitigation_timeout  = 60
    }
  }]
}

resource "cloudflare_zero_trust_access_policy" "staging" {
  for_each = local.staging_hosts

  account_id       = var.account_id
  name             = "freeism-${each.key}-staging-allow"
  decision         = "allow"
  session_duration = "8h"
  include          = [for email in var.access_allowed_emails : { email = { email = email } }]
}

resource "cloudflare_zero_trust_access_application" "staging" {
  for_each = local.staging_hosts

  account_id                 = var.account_id
  name                       = "freeism-${each.key}-staging"
  type                       = "self_hosted"
  domain                     = each.value
  session_duration           = "8h"
  enable_binding_cookie      = true
  http_only_cookie_attribute = true
  same_site_cookie_attribute = "strict"
  policies = [{
    id         = cloudflare_zero_trust_access_policy.staging[each.key].id
    precedence = 1
  }]
}

resource "cloudflare_turnstile_widget" "web_app" {
  for_each = local.hosts

  account_id      = var.account_id
  name            = "freeism-${each.key}-${var.environment}"
  domains         = [each.value]
  mode            = "managed"
  clearance_level = "no_clearance"
  region          = "world"
}

resource "cloudflare_notification_policy" "edge_native" {
  for_each = local.native_alerts

  account_id  = var.account_id
  name        = "freeism-web-app-${var.environment}-${replace(each.key, "_", "-")}"
  description = "Environment-wide Cloudflare native edge signal; correlate with app logs"
  alert_type  = each.value.alert_type
  enabled     = true
  filters     = each.value.filters
  mechanisms = {
    email = [{ id = var.ops_alert_email }]
  }
}

resource "cloudflare_email_routing_settings" "ops" {
  count = local.manage_zone_shared ? 1 : 0

  zone_id = var.zone_id
}

resource "cloudflare_email_routing_address" "ops" {
  account_id = var.account_id
  email      = var.ops_alert_email

  lifecycle {
    postcondition {
      condition     = self.verified != null && self.verified != ""
      error_message = "ops_alert_email must already be verified in Cloudflare"
    }
  }
}
