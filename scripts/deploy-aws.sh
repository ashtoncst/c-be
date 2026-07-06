#!/bin/bash

# Deploy script for AWS staging environment
# This script uses AWS CodeBuild to build and deploy the application to AWS ECS

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_PROFILE=${AWS_PROFILE:-"work"}
AWS_REGION=${AWS_REGION:-"ap-southeast-1"}
ENVIRONMENT=${ENVIRONMENT:-"staging"}
PROJECT_NAME="converge-backend"

echo -e "${GREEN}🚀 Starting deployment to AWS ${ENVIRONMENT}...${NC}"

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo -e "${RED}❌ Git is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo -e "${RED}❌ Terraform is required but not installed. Aborting.${NC}" >&2; exit 1; }

# Get Terraform outputs
echo -e "${YELLOW}📦 Getting infrastructure details...${NC}"
cd terraform
CODEBUILD_PROJECT=$(terraform output -raw codebuild_project_name 2>/dev/null || echo "")
ECR_REPO=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")
cd ..

if [ -z "$CODEBUILD_PROJECT" ]; then
    echo -e "${RED}❌ Could not get CodeBuild project name. Have you run 'terraform apply' yet?${NC}"
    echo -e "${YELLOW}💡 Run the following first:${NC}"
    echo -e "   cd terraform"
    echo -e "   terraform init"
    echo -e "   terraform apply"
    exit 1
fi

echo -e "${GREEN}✅ CodeBuild Project: ${CODEBUILD_PROJECT}${NC}"
echo -e "${GREEN}✅ ECR Repository: ${ECR_REPO}${NC}"

# Create temporary directory for source code
echo -e "${YELLOW}📂 Preparing source code...${NC}"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Create a source archive (excluding node_modules, dist, etc.)
git archive --format=zip --output="${TEMP_DIR}/source.zip" HEAD

# Upload source to S3 (CodeBuild will download it)
cd terraform
S3_BUCKET=$(terraform output -raw codebuild_cache_bucket)
cd ..

echo -e "${YELLOW}⬆️  Uploading source to S3...${NC}"
S3_KEY="source-builds/$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD).zip"
aws s3 cp "${TEMP_DIR}/source.zip" "s3://${S3_BUCKET}/${S3_KEY}" \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION}

echo -e "${GREEN}✅ Source uploaded to S3${NC}"

# Start CodeBuild build
echo -e "${YELLOW}🔨 Starting CodeBuild build...${NC}"
echo -e "${BLUE}This builds the Docker image on AWS (no local Docker needed)${NC}"

BUILD_ID=$(aws codebuild start-build \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --project-name ${CODEBUILD_PROJECT} \
    --source-type-override S3 \
    --source-location-override "${S3_BUCKET}/${S3_KEY}" \
    --query 'build.id' \
    --output text)

if [ -z "$BUILD_ID" ]; then
    echo -e "${RED}❌ Failed to start CodeBuild${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build started: ${BUILD_ID}${NC}"
echo -e "${YELLOW}⏳ Waiting for build to complete...${NC}"

# Wait for build to complete with status updates
while true; do
    BUILD_STATUS=$(aws codebuild batch-get-builds \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --ids ${BUILD_ID} \
        --query 'builds[0].buildStatus' \
        --output text)
    
    if [ "$BUILD_STATUS" = "SUCCEEDED" ]; then
        echo -e "${GREEN}✅ Build completed successfully!${NC}"
        break
    elif [ "$BUILD_STATUS" = "FAILED" ] || [ "$BUILD_STATUS" = "FAULT" ] || [ "$BUILD_STATUS" = "TIMED_OUT" ] || [ "$BUILD_STATUS" = "STOPPED" ]; then
        echo -e "${RED}❌ Build failed with status: ${BUILD_STATUS}${NC}"
        echo -e "${YELLOW}View logs at:${NC}"
        echo -e "  https://console.aws.amazon.com/codesuite/codebuild/projects/${CODEBUILD_PROJECT}/build/${BUILD_ID}/"
        exit 1
    else
        echo -e "${BLUE}⏳ Build status: ${BUILD_STATUS}...${NC}"
        sleep 10
    fi
done

# Update ECS service
echo -e "${YELLOW}🔄 Updating ECS service...${NC}"
aws ecs update-service \
    --profile ${AWS_PROFILE} \
    --cluster ${PROJECT_NAME}-${ENVIRONMENT}-cluster \
    --service ${PROJECT_NAME}-${ENVIRONMENT}-service \
    --force-new-deployment \
    --region ${AWS_REGION} \
    --no-cli-pager

echo -e "${GREEN}✅ ECS service update triggered${NC}"

# Get ALB URL
cd terraform
ALB_URL=$(terraform output -raw alb_url 2>/dev/null || echo "")
cd ..

if [ -n "$ALB_URL" ]; then
    echo -e ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e ""
    echo -e "📍 Application URL: ${YELLOW}${ALB_URL}${NC}"
    echo -e "📍 API Docs: ${YELLOW}${ALB_URL}/api/docs${NC}"
    echo -e ""
    echo -e "${YELLOW}⏳ Note: It may take 2-3 minutes for the new version to be deployed.${NC}"
    echo -e ""
    echo -e "To monitor deployment:"
    echo -e "  ${YELLOW}aws ecs describe-services --cluster ${PROJECT_NAME}-${ENVIRONMENT}-cluster --services ${PROJECT_NAME}-${ENVIRONMENT}-service --region ${AWS_REGION}${NC}"
    echo -e ""
    echo -e "To view application logs:"
    echo -e "  ${YELLOW}aws logs tail /ecs/${PROJECT_NAME}-${ENVIRONMENT} --follow --region ${AWS_REGION}${NC}"
    echo -e ""
    echo -e "To view build logs:"
    echo -e "  ${YELLOW}aws logs tail /aws/codebuild/${CODEBUILD_PROJECT} --follow --region ${AWS_REGION}${NC}"
else
    echo -e "${GREEN}✅ Deployment initiated!${NC}"
fi