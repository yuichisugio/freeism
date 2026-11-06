variable "account_id" {
  description = "Cloudflare account identifier."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone identifier for freeism.app."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "ops_alert_email" {
  description = "Pre-verified destination used by native and application alerts."
  type        = string
}
