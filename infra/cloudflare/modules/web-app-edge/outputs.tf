output "worker_custom_domain_owner" {
  description = "Worker custom domains are deliberately outside this module."
  value       = "wrangler"
}

output "turnstile_sitekeys" {
  description = "Environment-specific Turnstile site keys. Secret keys remain sensitive provider values."
  value       = { for app, widget in cloudflare_turnstile_widget.web_app : app => widget.sitekey }
}
