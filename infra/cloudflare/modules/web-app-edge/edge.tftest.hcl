mock_provider "cloudflare" {
  mock_resource "cloudflare_email_routing_address" {
    defaults = {
      verified = "2026-07-13T00:00:00Z"
    }
  }
}

run "staging_edge_contract" {
  command = plan

  variables {
    account_id            = "00000000000000000000000000000000"
    zone_id               = "11111111111111111111111111111111"
    environment           = "staging"
    access_allowed_emails = ["operator@example.com"]
    ops_alert_email       = "ops-staging@example.com"
  }

  assert {
    condition     = length(cloudflare_zero_trust_access_application.staging) == 2 && length(cloudflare_zero_trust_access_policy.staging) == 2
    error_message = "both staging hosts must have an Access application and policy"
  }

  assert {
    condition     = length(cloudflare_dns_record.www) == 0 && length(cloudflare_ruleset.root_redirect) == 0 && length(cloudflare_ruleset.managed_waf) == 0 && length(cloudflare_ruleset.edge_rate_limit) == 0
    error_message = "the staging workspace must not own zone-wide resources"
  }

  assert {
    condition     = length(cloudflare_turnstile_widget.web_app) == 2 && length(cloudflare_notification_policy.edge_native) == 3 && cloudflare_email_routing_address.ops.email == "ops-staging@example.com"
    error_message = "staging must have app-specific Turnstile widgets, native edge policies, and its verified ops destination inventory"
  }

  assert {
    condition     = alltrue([for name in concat(values(cloudflare_zero_trust_access_application.staging)[*].name, values(cloudflare_notification_policy.edge_native)[*].name) : strcontains(name, "staging") && !strcontains(name, "production")])
    error_message = "staging resource names must not contain production"
  }
}

run "production_shared_edge_contract" {
  command = plan

  variables {
    account_id            = "00000000000000000000000000000000"
    zone_id               = "11111111111111111111111111111111"
    environment           = "production"
    access_allowed_emails = []
    ops_alert_email       = "ops-production@example.com"
  }

  assert {
    condition     = length(cloudflare_dns_record.www) == 1 && cloudflare_dns_record.www[0].name == "www.freeism.app" && cloudflare_dns_record.www[0].proxied
    error_message = "production Terraform must own only the proxied www redirect endpoint; Wrangler owns the apex"
  }

  assert {
    condition     = cloudflare_ruleset.root_redirect[0].rules[0].action == "redirect" && cloudflare_ruleset.root_redirect[0].rules[0].expression == "http.host eq \"www.freeism.app\"" && cloudflare_ruleset.root_redirect[0].rules[0].action_parameters.from_value.status_code == 301 && !cloudflare_ruleset.root_redirect[0].rules[0].action_parameters.from_value.preserve_query_string && cloudflare_ruleset.root_redirect[0].rules[0].action_parameters.from_value.target_url.value == "https://freeism.app/"
    error_message = "www must permanently redirect to the canonical portal root without retaining path or query"
  }

  assert {
    condition     = cloudflare_ruleset.managed_waf[0].phase == "http_request_firewall_managed" && cloudflare_ruleset.edge_rate_limit[0].phase == "http_ratelimit" && cloudflare_ruleset.edge_rate_limit[0].rules[0].ratelimit.requests_per_period == 30
    error_message = "production must own managed WAF and the documented 30-per-minute IP WebSocket upgrade limit"
  }

  assert {
    condition     = length(cloudflare_zero_trust_access_application.staging) == 0 && length(cloudflare_zero_trust_access_policy.staging) == 0
    error_message = "production must not create staging Access resources"
  }

  assert {
    condition     = output.worker_custom_domain_owner == "wrangler"
    error_message = "Worker custom domains must remain owned by Wrangler"
  }
}
