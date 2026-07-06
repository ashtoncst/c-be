output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_url" {
  description = "URL to access the application"
  value       = local.has_certificate ? "https://${aws_lb.main.dns_name}" : "http://${aws_lb.main.dns_name}"
}

output "alb_http_url" {
  description = "HTTP URL (always available)"
  value       = "http://${aws_lb.main.dns_name}"
}

output "alb_https_url" {
  description = "HTTPS URL (only if certificate is configured)"
  value       = local.has_certificate ? "https://${aws_lb.main.dns_name}" : "Not configured - no SSL certificate"
}

output "wss_url" {
  description = "WebSocket Secure URL for chat"
  value       = local.has_certificate ? "wss://${aws_lb.main.dns_name}" : "ws://${aws_lb.main.dns_name}"
}

output "certificate_arn" {
  description = "ARN of the SSL certificate in use"
  value       = local.has_certificate ? local.certificate_arn : "No certificate configured"
}

output "ssl_enabled" {
  description = "Whether SSL/TLS is enabled"
  value       = local.has_certificate
}

output "ecr_repository_url" {
  description = "ECR repository URL for Docker images"
  value       = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.postgres.db_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.app.name
}

output "codebuild_project_name" {
  description = "CodeBuild project name"
  value       = aws_codebuild_project.app.name
}

output "codebuild_cache_bucket" {
  description = "S3 bucket for CodeBuild cache"
  value       = aws_s3_bucket.codebuild_cache.id
}
