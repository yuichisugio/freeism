terraform {
  backend "s3" {
    bucket                      = "freeism-terraform-state"
    key                         = "terraform.tfstate"
    workspace_key_prefix        = "web-app"
    region                      = "auto"
    use_lockfile                = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
