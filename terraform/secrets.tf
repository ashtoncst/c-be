# AWS Secrets Manager for sensitive data

# Database Password
resource "aws_secretsmanager_secret" "db_password" {
  name        = "${var.project_name}-${var.environment}-db-password"
  description = "PostgreSQL database password"

  tags = {
    Name = "${var.project_name}-${var.environment}-db-password"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

# Gemini API Key
resource "aws_secretsmanager_secret" "gemini_api_key" {
  name        = "${var.project_name}-${var.environment}-gemini-api-key"
  description = "Google Gemini API key for AI services"

  tags = {
    Name = "${var.project_name}-${var.environment}-gemini-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "gemini_api_key" {
  secret_id     = aws_secretsmanager_secret.gemini_api_key.id
  secret_string = var.gemini_api_key
}

# Resend API Key
resource "aws_secretsmanager_secret" "resend_api_key" {
  name        = "${var.project_name}-${var.environment}-resend-api-key"
  description = "Resend API key for email notifications"

  tags = {
    Name = "${var.project_name}-${var.environment}-resend-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "resend_api_key" {
  secret_id     = aws_secretsmanager_secret.resend_api_key.id
  secret_string = var.resend_api_key
}
