variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "work"
}

variable "environment" {
  description = "Environment name (e.g., staging, production)"
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "converge-backend"
}

variable "container_port" {
  description = "Port on which the container listens"
  type        = number
  default     = 3000
}

variable "container_cpu" {
  description = "CPU units for the container (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Memory for the container in MB"
  type        = number
  default     = 512
}

variable "db_instance_class" {
  description = "RDS instance class for staging"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "converge_staging_db"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "gcp_project_id" {
  description = "GCP Project ID for Vertex AI services"
  type        = string
}

variable "vertex_ai_location" {
  description = "Vertex AI location"
  type        = string
  default     = "us-central1"
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
}

# SSL/TLS and Domain Configuration
variable "domain_name" {
  description = "Custom domain name for the application (leave empty to skip SSL setup)"
  type        = string
  default     = ""
}

variable "subject_alternative_names" {
  description = "Additional domain names for the certificate (e.g., www.example.com)"
  type        = list(string)
  default     = []
}

variable "certificate_arn" {
  description = "ARN of existing ACM certificate (if not creating a new one)"
  type        = string
  default     = ""
}

variable "use_route53" {
  description = "Whether to use Route53 for DNS validation (requires route53_zone_id)"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS validation"
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "Enable HTTPS listener (requires either domain_name or certificate_arn)"
  type        = bool
  default     = true
}

variable "force_https_redirect" {
  description = "Force HTTP to HTTPS redirect"
  type        = bool
  default     = false
}

variable "use_cloudfront" {
  description = "Use CloudFront for HTTPS without custom domain"
  type        = bool
  default     = false
}

variable "github_repository_url" {
  description = "GitHub repository URL for CodeBuild source"
  type        = string
  default     = "https://github.com/your-org/converge-global-be.git"
}

# Resend Email Configuration
variable "resend_api_key" {
  description = "Resend API key for email notifications"
  type        = string
  sensitive   = true
  default     = ""
}

variable "sales_lead_recipient_email" {
  description = "Email address to receive sales lead notifications"
  type        = string
  default     = "wayne.chan@tangent.sg"
}

variable "sales_lead_from_email" {
  description = "Sender email address for sales lead notifications"
  type        = string
  default     = "onboarding@resend.dev"
}

variable "sales_lead_from_name" {
  description = "Sender name for sales lead notifications"
  type        = string
  default     = "GBG Portal"
}
