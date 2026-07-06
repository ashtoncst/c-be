# AWS & Terraform Documentation

**Purpose:** Complete AWS infrastructure and Terraform deployment documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure Overview](#infrastructure-overview)
3. [Terraform Setup](#terraform-setup)
4. [AWS Resources](#aws-resources)
5. [Deployment Guide](#deployment-guide)
6. [Configuration](#configuration)
7. [Cost Management](#cost-management)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Converge Backend is deployed on **AWS** using **Terraform** for Infrastructure as Code (IaC). The infrastructure includes:

- **ECS Fargate**: Serverless container hosting
- **RDS PostgreSQL**: Managed database
- **Application Load Balancer**: HTTP/WebSocket routing
- **VPC**: Isolated network environment
- **ECR**: Docker image registry
- **Secrets Manager**: Secure credential storage

**Estimated Monthly Cost:** ~$85-100 (staging environment)

---

## Infrastructure Overview

### Architecture Diagram

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│   Application Load Balancer (ALB)   │
│   - HTTP/HTTPS (port 80/443)        │
│   - WebSocket support                │
│   - SSL termination                  │
│   - Health checks                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         VPC (10.0.0.0/16)           │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Public Subnets                │ │
│  │ - ALB                         │ │
│  │ - NAT Gateway                 │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Private Subnets               │ │
│  │ - ECS Fargate Tasks           │ │
│  │ - RDS PostgreSQL              │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Resource Breakdown

| Resource        | Type               | Purpose                   | Estimated Cost |
| --------------- | ------------------ | ------------------------- | -------------- |
| VPC             | Networking         | Isolated network          | $0             |
| ALB             | Load Balancer      | HTTP/WebSocket routing    | ~$20/month     |
| ECS Fargate     | Containers         | Backend application       | ~$15/month     |
| RDS             | Database           | PostgreSQL (db.t4g.micro) | ~$15/month     |
| NAT Gateway     | Networking         | Outbound internet         | ~$32/month     |
| ECR             | Container Registry | Docker images             | ~$1/month      |
| Secrets Manager | Security           | Credentials               | ~$0.40/month   |

**Total:** ~$83-100/month (excluding data transfer)

---

## Terraform Setup

### Prerequisites

1. **AWS CLI** (v2+)

   ```bash
   aws --version
   ```

2. **Terraform** (v1.0+)

   ```bash
   terraform version
   ```

3. **AWS Account** with appropriate permissions

4. **AWS Credentials** configured
   ```bash
   aws configure
   aws sts get-caller-identity  # Verify access
   ```

### Initial Setup

#### Step 1: Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
# AWS Configuration
aws_region   = "ap-southeast-1"  # Change to your preferred region
environment  = "staging"
project_name = "converge-backend"

# Container Configuration
container_port   = 3000
container_cpu    = 256   # 0.25 vCPU (adequate for staging)
container_memory = 512   # 512 MB

# Database Configuration
db_instance_class = "db.t4g.micro"  # Smallest RDS instance
db_name           = "converge_staging_db"
db_username       = "postgres"
db_password       = "YOUR_STRONG_PASSWORD_HERE"  # CHANGE THIS!

# Google Cloud Configuration (for AI services)
gcp_project_id     = "your-gcp-project-id"
vertex_ai_location  = "us-central1"
gemini_api_key      = "your-gemini-api-key"
```

**Important:**

- Use a strong, unique password for `db_password`
- Never commit `terraform.tfvars` to git (it's in .gitignore)
- Store sensitive values in AWS Secrets Manager for production

#### Step 2: Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads the AWS provider and initializes the workspace.

#### Step 3: Review Terraform Plan

```bash
terraform plan
```

Review the resources that will be created:

- VPC with public/private subnets
- RDS PostgreSQL instance
- ECS cluster and service
- Application Load Balancer
- Security groups
- ECR repository
- Secrets in AWS Secrets Manager

#### Step 4: Apply Terraform Configuration

```bash
terraform apply
```

Type `yes` when prompted.

**This will take 10-15 minutes** as AWS provisions:

- RDS instance (slowest part, ~10 minutes)
- VPC and networking (~2 minutes)
- Load balancer (~2 minutes)
- ECS cluster (~1 minute)

---

## AWS Resources

### Terraform Files

**Location:** `terraform/`

| File            | Purpose                                     |
| --------------- | ------------------------------------------- |
| `main.tf`       | Provider configuration and common resources |
| `variables.tf`  | Input variable definitions                  |
| `networking.tf` | VPC, subnets, routing                       |
| `ecs.tf`        | ECS cluster, service, task definition       |
| `rds.tf`        | RDS PostgreSQL instance                     |
| `alb.tf`        | Application Load Balancer                   |
| `ecr.tf`        | ECR repository                              |
| `secrets.tf`    | AWS Secrets Manager configuration           |
| `outputs.tf`    | Terraform outputs (URLs, IDs, etc.)         |
| `acm.tf`        | SSL certificate (ACM)                       |
| `codebuild.tf`  | CI/CD pipeline (optional)                   |

### Key Resources

#### VPC (`networking.tf`)

- **CIDR**: 10.0.0.0/16
- **Public Subnets**: 2 (for ALB and NAT Gateway)
- **Private Subnets**: 2 (for ECS and RDS)
- **Internet Gateway**: For public subnet access
- **NAT Gateway**: For private subnet outbound access

#### ECS (`ecs.tf`)

- **Cluster**: `converge-backend-staging-cluster`
- **Service**: `converge-backend-staging-service`
- **Task Definition**: CPU 256 (0.25 vCPU), Memory 512 MB
- **Auto-scaling**: Configured but disabled by default
- **Logging**: CloudWatch Logs

#### RDS (`rds.tf`)

- **Instance Class**: db.t4g.micro (smallest)
- **Engine**: PostgreSQL 16.8
- **Storage**: 20 GB (gp3)
- **Backups**: Automated daily backups (7-day retention)
- **Multi-AZ**: Disabled for staging (enabled for production)
- **Security**: In private subnet, no public access

#### ALB (`alb.tf`)

- **Scheme**: Internet-facing
- **Listeners**: HTTP (80), HTTPS (443) - if SSL configured
- **Target Group**: Health checks on `/` endpoint
- **Sticky Sessions**: Enabled for WebSocket support
- **SSL Certificate**: ACM certificate (if configured)

#### ECR (`ecr.tf`)

- **Repository**: `converge-backend-staging`
- **Image Tag**: Latest
- **Lifecycle Policy**: Keeps last 10 images

#### Secrets Manager (`secrets.tf`)

Stores:

- Database password
- GCP project ID
- Gemini API key
- Other sensitive configuration

---

## Deployment Guide

### Initial Deployment

**See:** [aws-deployment-guide.md](../aws-deployment-guide.md) for complete step-by-step guide

**Quick Summary:**

1. Configure `terraform.tfvars`
2. Run `terraform init`
3. Run `terraform plan` (review)
4. Run `terraform apply`
5. Get outputs: `terraform output`
6. Build and push Docker image
7. ECS service automatically deploys

### Updating Infrastructure

```bash
cd terraform

# Make changes to .tf files
# Edit variables or resources

# Preview changes
terraform plan

# Apply changes
terraform apply
```

### Updating Application

```bash
# Build new Docker image
docker build -t converge-backend:latest .

# Push to ECR (see scripts/deploy-aws.sh)
ECR_REPO=$(cd terraform && terraform output -raw ecr_repository_url)
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin $ECR_REPO
docker tag converge-backend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Force ECS deployment
aws ecs update-service \
  --cluster converge-backend-staging-cluster \
  --service converge-backend-staging-service \
  --force-new-deployment \
  --region ap-southeast-1
```

**Or use helper script:**

```bash
./scripts/deploy-aws.sh
```

---

## Configuration

### Environment Variables

ECS task definition includes environment variables from:

1. **Terraform variables** (non-sensitive)
2. **AWS Secrets Manager** (sensitive)

**Key Variables:**

- `NODE_ENV`: `production`
- `PORT`: `3000`
- `DB_HOST`: RDS endpoint (from Secrets Manager)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: From Secrets Manager
- `GCP_PROJECT_ID`: From Secrets Manager
- `GEMINI_API_KEY`: From Secrets Manager

### Scaling Configuration

**ECS Service:**

```hcl
desired_count = 1  # Default: 1 task
```

To scale up:

```bash
aws ecs update-service \
  --cluster converge-backend-staging-cluster \
  --service converge-backend-staging-service \
  --desired-count 2 \
  --region ap-southeast-1
```

**Auto-scaling** can be enabled in `ecs.tf` (currently disabled)

**Database Scaling:**

- Current: db.t4g.micro
- Can scale to: db.t4g.small, db.t4g.medium, etc.
- Update in `terraform.tfvars` and apply

---

## Cost Management

### Current Monthly Costs (~$85-100)

| Service         | Cost     | Notes                      |
| --------------- | -------- | -------------------------- |
| NAT Gateway     | ~$32     | Fixed cost + data transfer |
| ALB             | ~$20     | Fixed cost                 |
| RDS             | ~$15     | db.t4g.micro               |
| ECS Fargate     | ~$15     | 0.25 vCPU, 512 MB          |
| Data Transfer   | Variable | ~$5-10 typically           |
| ECR             | ~$1      | Storage                    |
| Secrets Manager | ~$0.40   | Storage                    |

### Cost Optimization Strategies

#### 1. Stop When Not in Use

```bash
# Scale ECS to 0 (stops charges for Fargate)
aws ecs update-service \
  --cluster converge-backend-staging-cluster \
  --service converge-backend-staging-service \
  --desired-count 0 \
  --region ap-southeast-1

# To restart:
aws ecs update-service \
  --cluster converge-backend-staging-cluster \
  --service converge-backend-staging-service \
  --desired-count 1 \
  --region ap-southeast-1
```

#### 2. Remove NAT Gateway (if not needed)

If your application doesn't need outbound internet:

- Remove NAT Gateway from `networking.tf`
- Save ~$32/month
- Note: Need NAT for external API calls (Gemini, etc.)

#### 3. Use Reserved Instances (Production)

For production, consider:

- RDS Reserved Instances (40-50% savings)
- ECS Capacity Reservations

#### 4. AWS Budgets

Set up AWS Budgets to monitor spending:

```bash
# Via AWS Console: Cost Management → Budgets
# Set alert at $100/month
```

#### 5. Destroy Resources

To completely remove infrastructure:

```bash
cd terraform
terraform destroy
```

**Warning:** This permanently deletes all resources and data!

---

## Troubleshooting

### Issue: Terraform Apply Fails

**Error:** "Error creating RDS instance"

**Solution:**

1. Check AWS service limits
2. Verify RDS subnet group exists
3. Check security group rules
4. Verify credentials have RDS permissions

### Issue: ECS Tasks Won't Start

**Error:** Tasks in PENDING state

**Solution:**

1. Check CloudWatch logs
2. Verify task definition is valid
3. Check security groups allow traffic
4. Verify ECR image exists and is accessible

```bash
# Check task status
aws ecs describe-tasks \
  --cluster converge-backend-staging-cluster \
  --tasks TASK_ARN \
  --region ap-southeast-1

# Check logs
aws logs tail /ecs/converge-backend-staging --follow --region ap-southeast-1
```

### Issue: Database Connection Fails

**Error:** "Connection timeout" from application

**Solution:**

1. Verify RDS is in private subnet
2. Check security group allows ECS → RDS (port 5432)
3. Verify database credentials in Secrets Manager
4. Check RDS instance is running

```bash
# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier converge-backend-staging-db \
  --region ap-southeast-1 \
  --query 'DBInstances[0].DBInstanceStatus'

# Check security groups
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=converge-backend-staging-rds-sg" \
  --region ap-southeast-1
```

### Issue: ALB Health Checks Failing

**Error:** Targets showing as unhealthy

**Solution:**

1. Verify container is listening on port 3000
2. Check health check endpoint `/` returns 200 OK
3. Verify security group allows ALB → ECS (port 3000)
4. Check container startup time (may need longer grace period)

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn TARGET_GROUP_ARN \
  --region ap-southeast-1
```

### Issue: High Costs

**Error:** Unexpected AWS bill

**Solution:**

1. Check AWS Cost Explorer
2. Verify resources are tagged correctly
3. Check for orphaned resources
4. Review data transfer costs
5. Consider stopping unused resources

---

## Terraform Outputs

After deployment, get important values:

```bash
cd terraform
terraform output
```

**Common Outputs:**

- `alb_url`: Application Load Balancer URL
- `rds_endpoint`: Database connection endpoint
- `ecr_repository_url`: Docker image repository URL
- `ecs_cluster_name`: ECS cluster name
- `ecs_service_name`: ECS service name

**Example:**

```bash
# Get ALB URL
terraform output -raw alb_url

# Get RDS endpoint
terraform output -raw rds_endpoint
```

---

## Security Best Practices

1. **Never commit secrets** to git
2. **Use Secrets Manager** for sensitive values
3. **Enable VPC flow logs** for network monitoring
4. **Use least privilege IAM** roles
5. **Enable RDS encryption** at rest
6. **Regularly rotate** database passwords
7. **Enable CloudTrail** for audit logging
8. **Use SSL/TLS** for all connections

---

## Next Steps

1. **Add CloudFront CDN** for static assets
2. **Enable WAF** on ALB for security
3. **Set up CloudWatch Alarms** for monitoring
4. **Configure RDS automated backups** with longer retention
5. **Add production environment** with separate Terraform workspace
6. **Implement blue-green deployments** for zero downtime

---

## Reference Documents

- [aws-deployment-guide.md](../aws-deployment-guide.md) - Detailed deployment guide
- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) - Pre/post deployment checklist
- [STAGING_SSL_SETUP.md](../STAGING_SSL_SETUP.md) - SSL certificate setup
- [terraform/README.md](../../terraform/README.md) - Terraform-specific documentation

---

## Terraform State Management

**State File:** `terraform/terraform.tfstate`

**Important:**

- State file contains sensitive data
- **Never commit** to git (in .gitignore)
- Consider using **S3 backend** for team collaboration
- Use **Terraform Cloud** for remote state

**Setup S3 Backend (Recommended):**

```hcl
# In terraform/main.tf
terraform {
  backend "s3" {
    bucket         = "converge-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
```

---

**Document Maintained By:** DevOps Team
