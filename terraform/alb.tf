# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  enable_deletion_protection = false # Set to true in production
  enable_http2               = true  # Required for WebSocket upgrades
  drop_invalid_header_fields = true  # Security best practice

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# Target Group
resource "aws_lb_target_group" "app" {
  name        = "${var.project_name}-${var.environment}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/"
    matcher             = "200"
  }

  # Support for WebSocket connections
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-tg"
  }
}

# Local variable to determine certificate ARN
locals {
  certificate_arn = (
    var.certificate_arn != "" ? var.certificate_arn :
    var.domain_name != "" ? aws_acm_certificate.main[0].arn :
    null
  )
  has_certificate = local.certificate_arn != null
}

# HTTP Listener
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  # Redirect to HTTPS if certificate is available and redirect is forced
  default_action {
    type = var.force_https_redirect && local.has_certificate ? "redirect" : "forward"

    # Forward action (used when not redirecting)
    dynamic "forward" {
      for_each = var.force_https_redirect && local.has_certificate ? [] : [1]
      content {
        target_group {
          arn = aws_lb_target_group.app.arn
        }
      }
    }

    # Redirect action (used when forcing HTTPS)
    dynamic "redirect" {
      for_each = var.force_https_redirect && local.has_certificate ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-http-listener"
  }
}

# HTTPS Listener (enabled when certificate is available)
resource "aws_lb_listener" "https" {
  count             = var.enable_https && local.has_certificate ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"

  # Modern TLS policy - supports TLS 1.2 and 1.3
  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn = local.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-https-listener"
  }
}
