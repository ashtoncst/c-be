# CI/CD Documentation

**Purpose:** Complete CI/CD pipeline documentation for automated deployments

---

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [GitHub Actions Setup](#github-actions-setup)
4. [CodeBuild Alternative](#codebuild-alternative)
5. [Deployment Process](#deployment-process)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The Converge Backend uses **GitHub Actions** (recommended) or **AWS CodeBuild** for automated CI/CD. Both options support automatic deployment when code is pushed to the `dev` branch.

### Current Setup

- **Primary**: GitHub Actions workflow (`.github/workflows/deploy-staging.yml`)
- **Alternative**: AWS CodeBuild project (can be enabled with webhook)
- **Build Artifact**: Docker image pushed to AWS ECR
- **Deployment Target**: AWS ECS Fargate service
- **Environment**: Staging environment on AWS

---

## Pipeline Architecture

### GitHub Actions Flow

```
Push to `dev` branch
    │
    ▼
┌──────────────────────┐
│ GitHub Actions       │
│ 1. Checkout code     │
│ 2. Setup Node.js     │
│ 3. Install deps      │
│ 4. Run tests         │
│ 5. Build Docker      │
│ 6. Push to ECR       │
│ 7. Update ECS service│
│ 8. Wait for rollout  │
└──────────────────────┘
    │
    ▼
┌──────────────────────┐
│ AWS ECR              │
│ Docker image stored  │
└──────────────────────┘
    │
    ▼
┌──────────────────────┐
│ AWS ECS              │
│ New task deployed    │
│ Health checks run    │
└──────────────────────┘
```

### Key Stages

1. **Build**: Compile TypeScript and create Docker image
2. **Test**: Run unit and integration tests (optional)
3. **Push**: Upload Docker image to ECR
4. **Deploy**: Update ECS service to use new image
5. **Verify**: Wait for deployment to stabilize

---

## GitHub Actions Setup

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **ECR Repository** (created via Terraform)
3. **ECS Cluster and Service** (created via Terraform)
4. **GitHub Secrets** configured

### Step 1: Configure GitHub Secrets

Go to: `https://github.com/YOUR_ORG/converge-global-be/settings/secrets/actions`

Add these secrets:

| Secret Name             | Description         | How to Get                            |
| ----------------------- | ------------------- | ------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | AWS access key      | AWS IAM → Create user → Access keys   |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key      | Generated with access key ID          |
| `AWS_REGION`            | AWS region          | e.g., `ap-southeast-1`                |
| `ECR_REPOSITORY`        | ECR repository name | `terraform output ecr_repository_url` |
| `ECS_CLUSTER`           | ECS cluster name    | `terraform output ecs_cluster_name`   |
| `ECS_SERVICE`           | ECS service name    | `terraform output ecs_service_name`   |

### Step 2: Verify Workflow File

The workflow file should be at:

```
.github/workflows/deploy-staging.yml
```

**Key Configuration:**

- Triggers on push to `dev` branch
- Builds Docker image
- Pushes to ECR
- Updates ECS service

### Step 3: Test Deployment

```bash
# Make a small change
echo "# Test deployment" >> README.md

# Commit and push
git add README.md
git commit -m "test: trigger CI/CD pipeline"
git push origin dev

# Monitor deployment
# Go to GitHub → Actions tab → Watch the workflow run
```

### Step 4: Verify Deployment

```bash
# Check ECS service status
aws ecs describe-services \
  --cluster converge-backend-staging-cluster \
  --services converge-backend-staging-service \
  --region ap-southeast-1 \
  --query 'services[0].deployments[*].{status:status,desiredCount:desiredCount,runningCount:runningCount}'

# Check task is running new image
aws ecs describe-tasks \
  --cluster converge-backend-staging-cluster \
  --tasks $(aws ecs list-tasks --cluster converge-backend-staging-cluster --service converge-backend-staging-service --region ap-southeast-1 --query 'taskArns[0]' --output text) \
  --region ap-southeast-1 \
  --query 'tasks[0].containers[0].image'
```

---

## CodeBuild Alternative

If you prefer AWS CodeBuild over GitHub Actions:

### Enable CodeBuild Webhook

**File:** `terraform/codebuild.tf`

Add after line 173:

```hcl
resource "aws_codebuild_webhook" "app" {
  project_name = aws_codebuild_project.app.name

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PUSH"
    }

    filter {
      type    = "HEAD_REF
      pattern = "^refs/heads/dev$"
    }
  }
}
```

**Apply Terraform:**

```bash
cd terraform
terraform apply
```

### CodeBuild Configuration

**File:** `buildspec.yml`

The buildspec.yml file already includes:

- Docker image build
- ECR push
- ECS service update

**Note:** CodeBuild webhook was not initially configured. The GitHub Actions approach is recommended for better visibility and cost (free for public repos).

---

## Deployment Process

### Automatic Deployment

**Trigger:** Push to `dev` branch

**Process:**

1. GitHub Actions workflow starts
2. Code is checked out
3. Dependencies installed
4. Docker image built
5. Image tagged and pushed to ECR
6. ECS service updated
7. New tasks start
8. Health checks verify deployment
9. Old tasks terminated

**Duration:** ~5-10 minutes

### Manual Deployment

If you need to deploy manually:

```bash
# Build and push Docker image
./scripts/deploy-aws.sh

# Or manually:
# 1. Get ECR repository URL
cd terraform
ECR_REPO=$(terraform output -raw ecr_repository_url)

# 2. Build Docker image
docker build -t converge-backend:latest .

# 3. Login to ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin $ECR_REPO

# 4. Tag and push
docker tag converge-backend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# 5. Force ECS deployment
aws ecs update-service \
  --cluster converge-backend-staging-cluster \
  --service converge-backend-staging-service \
  --force-new-deployment \
  --region ap-southeast-1
```

---

## Configuration

### GitHub Actions Workflow

**File:** `.github/workflows/deploy-staging.yml`

**Key Sections:**

1. **Triggers:**

   ```yaml
   on:
     push:
       branches:
         - dev
   ```

2. **Environment Variables:**

   ```yaml
   env:
     AWS_REGION: ${{ secrets.AWS_REGION }}
     ECR_REPOSITORY: ${{ secrets.ECR_REPOSITORY }}
     ECS_CLUSTER: ${{ secrets.ECS_CLUSTER }}
     ECS_SERVICE: ${{ secrets.ECS_SERVICE }}
   ```

3. **Build Steps:**
   - Checkout code
   - Configure AWS credentials
   - Login to ECR
   - Build and push Docker image
   - Update ECS service
   - Wait for deployment stabilization

### Dockerfile

**File:** `Dockerfile`

Key configuration:

- Multi-stage build
- Node.js 20 base image
- TypeScript compilation
- Production dependencies only
- Exposes port 3000

### Buildspec.yml (CodeBuild)

**File:** `buildspec.yml`

Contains:

- Pre-build: Docker setup
- Build: Image build and push
- Post-build: ECS service update

---

## Troubleshooting

### Issue: Workflow Fails on ECR Login

**Error:** `Unable to locate credentials`

**Solution:**

1. Verify GitHub secrets are set correctly
2. Check AWS credentials have ECR permissions
3. Ensure IAM user has `ecr:GetAuthorizationToken` permission

### Issue: Deployment Succeeds but Service Unhealthy

**Error:** ECS tasks keep restarting

**Solution:**

1. Check CloudWatch logs for application errors
2. Verify environment variables in ECS task definition
3. Check database connection (security groups)
4. Verify health check endpoint responds correctly

```bash
# Check logs
aws logs tail /ecs/converge-backend-staging --follow --region ap-southeast-1

# Check task exit reason
aws ecs describe-tasks \
  --cluster converge-backend-staging-cluster \
  --tasks TASK_ARN \
  --region ap-southeast-1 \
  --query 'tasks[0].containers[0].{Reason:reason,ExitCode:exitCode}'
```

### Issue: Build Takes Too Long

**Error:** Workflow times out

**Solution:**

1. Optimize Dockerfile (use .dockerignore)
2. Use Docker layer caching
3. Consider CodeBuild larger instances
4. Split build and deploy into separate jobs

### Issue: ECS Service Not Updating

**Error:** Deployment completes but service still running old image

**Solution:**

1. Verify ECS service name is correct
2. Check service is not in draining state
3. Force new deployment manually
4. Check ECS service events for errors

```bash
# Check service events
aws ecs describe-services \
  --cluster converge-backend-staging-cluster \
  --services converge-backend-staging-service \
  --region ap-southeast-1 \
  --query 'services[0].events[0:5]'
```

---

## Best Practices

### 1. Branch Strategy

- **dev**: Auto-deploy to staging
- **main**: Manual deploy to production (future)
- **Feature branches**: No automatic deployment

### 2. Testing

Add test stage before deployment:

```yaml
- name: Run tests
  run: npm test
```

### 3. Rollback Strategy

If deployment fails:

```bash
# Revert to previous ECR image
aws ecs update-service \
  --cluster converge-backend-staging-cluster \
  --service converge-backend-staging-service \
  --force-new-deployment \
  --region ap-southeast-1
```

### 4. Notifications

Add Slack/Discord notifications for deployment status (future enhancement)

### 5. Blue-Green Deployments

For zero-downtime deployments, configure ECS with multiple task sets (future enhancement)

---

## Comparison: GitHub Actions vs CodeBuild

| Feature            | GitHub Actions               | CodeBuild            |
| ------------------ | ---------------------------- | -------------------- |
| **Setup**          | Add secrets to GitHub        | Configure Terraform  |
| **Visibility**     | GitHub UI                    | AWS Console          |
| **Logs**           | GitHub Actions tab           | CloudWatch           |
| **Cost**           | Free for public repos        | Pay per build minute |
| **Control**        | Full YAML control            | Uses buildspec.yml   |
| **Integration**    | Native GitHub                | AWS-native           |
| **Recommendation** | ⭐ **Better for most teams** | Good for AWS-only    |

---

## Next Steps

1. **Add production environment** deployment workflow
2. **Implement blue-green deployments** for zero downtime
3. **Add automated testing** in CI pipeline
4. **Set up deployment notifications** (Slack/email)
5. **Add manual approval gates** for production deployments

---

**Reference Documents:**

- [CICD_SETUP.md](../CICD_SETUP.md) - Original setup guide
- [aws-deployment-guide.md](../aws-deployment-guide.md) - AWS deployment details
- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) - Pre/post deployment checklist

---

**Document Maintained By:** DevOps Team
