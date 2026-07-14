variable "account_id" {
  description = "Cloudflare account identifier."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone identifier for freeism.app."
  type        = string
}

variable "environment" {
  description = "Must match the selected Terraform workspace."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "access_allowed_emails" {
  description = "Staging identities allowed through Cloudflare Access."
  type        = set(string)
  default     = []
}

variable "ops_alert_email" {
  description = "Cloudflare-verified operations destination for this environment."
  type        = string
}
