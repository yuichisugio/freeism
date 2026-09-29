UPDATE oauth_client SET dpop_bound_access_tokens = 1;--> statement-breakpoint
UPDATE oauth_resource SET dpop_bound_access_tokens_required = 1;
