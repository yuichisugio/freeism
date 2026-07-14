check "workspace_matches_environment" {
  assert {
    condition     = terraform.workspace == var.environment
    error_message = "Terraform workspace must exactly match var.environment"
  }
}

module "web_app_edge" {
  source = "./modules/web-app-edge"

  account_id            = var.account_id
  zone_id               = var.zone_id
  environment           = var.environment
  access_allowed_emails = var.access_allowed_emails
  ops_alert_email       = var.ops_alert_email
}
