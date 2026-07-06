# CloudFront Distribution for HTTPS without Custom Domain
# Provides free HTTPS via CloudFront's default certificate

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  count   = var.use_cloudfront ? 1 : 0
  enabled = true
  comment = "${var.project_name}-${var.environment} CDN"

  # Point to ALB
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "ALB"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # ALB is HTTP
      origin_ssl_protocols   = ["TLSv1.2"]
      # Increase timeouts for WebSocket connections
      # This prevents CloudFront from closing idle WebSocket connections
      origin_read_timeout      = 120 # Seconds CloudFront waits for response (default 30)
      origin_keepalive_timeout = 120 # Seconds CloudFront keeps connection alive (default 5)
    }

    # Support WebSockets and preserve headers
    custom_header {
      name  = "X-Forwarded-Proto"
      value = "https"
    }
  }

  # Default cache behavior (no caching for API)
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "ALB"
    viewer_protocol_policy = "redirect-to-https"

    # Forward everything to ALB (disable caching)
    forwarded_values {
      query_string = true
      headers = [
        "Authorization",
        "CloudFront-Forwarded-Proto",
        "Host",
        "Origin",
        "Referer",
        "User-Agent",
        "Accept",
        "Accept-Language",
        "Content-Type",
        # WebSocket-specific headers (CloudFront handles Upgrade/Connection automatically)
        # Only forward the Sec-WebSocket-* headers that are allowed
        "Sec-WebSocket-Key",
        "Sec-WebSocket-Version",
        "Sec-WebSocket-Protocol",
        "Sec-WebSocket-Extensions",
      ]

      cookies {
        forward = "all"
      }
    }

    # No caching
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0

    compress = true
  }

  # Price class (cheapest - North America & Europe)
  price_class = "PriceClass_100"

  # SSL Certificate (CloudFront provides free certificate)
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  # No geo restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # WebSocket support
  http_version = "http2and3"

  tags = {
    Name        = "${var.project_name}-${var.environment}-cdn"
    Environment = var.environment
  }
}

# Outputs
output "cloudfront_url" {
  description = "CloudFront distribution URL (HTTPS enabled)"
  value       = var.use_cloudfront ? "https://${aws_cloudfront_distribution.main[0].domain_name}" : "Not using CloudFront"
}

output "cloudfront_domain" {
  description = "CloudFront domain name for API calls"
  value       = var.use_cloudfront ? aws_cloudfront_distribution.main[0].domain_name : "Not using CloudFront"
}

output "cloudfront_wss_url" {
  description = "WebSocket Secure URL via CloudFront"
  value       = var.use_cloudfront ? "wss://${aws_cloudfront_distribution.main[0].domain_name}" : "Not using CloudFront"
}

