# Kubernetes Deployment Guide

**Purpose:** Complete guide for deploying Converge Global application to Kubernetes with on-premise PostgreSQL

**Last Updated:** November 19, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup](#database-setup)
4. [Environment Variables](#environment-variables)
5. [Docker Image Build](#docker-image-build)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Converge Global is a full-stack AI-powered telecommunications chatbot platform consisting of:

- **Backend**: Node.js/Express.js API with Socket.IO for real-time chat (Port 3000)
- **Frontend**: Next.js React application (Port 3000 internally)
- **Database**: PostgreSQL 16.8+ (on-premise)
- **AI Service**: Google Gemini API (external)

### Architecture in Kubernetes

```
┌─────────────────────────────────────────────────┐
│              Kubernetes Cluster                  │
│                                                  │
│  ┌──────────────┐         ┌──────────────┐     │
│  │   Frontend   │         │   Backend    │     │
│  │   (Next.js)  │────────▶│  (Node.js)   │     │
│  │   Port 3000  │  HTTP   │  Port 3000   │     │
│  └──────┬───────┘         └──────┬───────┘     │
│         │                        │              │
│         │                        │ Socket.IO    │
│         │                        │ (WebSocket)  │
└─────────┼────────────────────────┼──────────────┘
          │                        │
          │                        ▼
       Ingress              ┌──────────────┐
      (External)            │  PostgreSQL  │
                            │  (On-Premise)│
                            │  Port 5432   │
                            └──────────────┘
                                   │
                            ┌──────▼───────┐
                            │  Google      │
                            │  Gemini API  │
                            │  (External)  │
                            └──────────────┘
```

---

## Prerequisites

### Required Software

1. **Kubernetes Cluster** (v1.24+)

   - Kubectl configured and connected to your cluster
   - Sufficient resources (see [Resource Requirements](#resource-requirements))

2. **PostgreSQL Database** (v16.8+)

   - On-premise or accessible from Kubernetes cluster
   - Network connectivity from pods to database
   - Database credentials with full access

3. **Docker Registry**

   - Access to push/pull Docker images
   - Authentication credentials configured in Kubernetes

4. **Google Gemini API Key**
   - Sign up at: https://ai.google.dev/
   - API key with Gemini access enabled

### Resource Requirements

**Backend Pod:**

- CPU: 500m (min) / 2000m (max)
- Memory: 512Mi (min) / 2Gi (max)
- Disk: 1Gi ephemeral storage

**Frontend Pod:**

- CPU: 250m (min) / 1000m (max)
- Memory: 256Mi (min) / 1Gi (max)
- Disk: 1Gi ephemeral storage

**Total Cluster Requirements (minimum):**

- 2 vCPU cores
- 4 GB RAM
- 10 GB storage

---

## Database Setup

### Step 1: Verify PostgreSQL Connection

Ensure your PostgreSQL database is accessible from the Kubernetes cluster:

```bash
# Test connection from a pod
kubectl run -it --rm psql-test --image=postgres:16 --restart=Never -- \
  psql -h YOUR_DB_HOST -p 5432 -U postgres -d postgres -c "SELECT version();"
```

**Expected Output:**

```
PostgreSQL 16.8 (or higher)
```

### Step 2: Create Database

```bash
# Connect to PostgreSQL
psql -h YOUR_DB_HOST -p 5432 -U postgres

# Create the database
CREATE DATABASE converge_staging_db;

# Grant permissions (if needed)
GRANT ALL PRIVILEGES ON DATABASE converge_staging_db TO postgres;

# Exit
\q
```

### Step 3: Initialize Database (Schema + Seed Data)

Run the single initialization script that creates all tables and seeds the product catalog:

```bash
# From the converge-global-be directory
psql -h YOUR_DB_HOST -p 5432 -U postgres -d converge_staging_db \
  < docs/db-scripts/init-database-20260407.sql
```

**What this creates:**

- ✅ 15 database tables (users, chat_sessions, chat_conversations, items, item_feature, etc.)
- ✅ Foreign key constraints
- ✅ Indexes (including full-text search indexes)
- ✅ Functions (session cleanup)
- ✅ Triggers (automatic timestamp updates)

**What this seeds:**

- ✅ `feature` - Product features (~319 items)
- ✅ `item` - Product catalog (~1,044 items)
- ✅ `product` - Products (legacy table)
- ✅ `product_category` - Categories
- ✅ `product_feature` - Feature relationships
- ✅ `target_audience` - Customer segments

**Clean tables (no initial data):**

- `chat_conversations` - Empty (no chat history)
- `chat_sessions` - Empty (no sessions)
- `sales_lead` - Empty (no leads)
- `user_selection` - Empty (no cart data)
- `session_cleanup_logs` - Empty (no logs)

### Step 5: Verify Database Setup

```bash
# Connect to database
psql -h YOUR_DB_HOST -p 5432 -U postgres -d converge_staging_db

# Check tables
\dt

# Verify data
SELECT COUNT(*) FROM item;          -- Should show ~1044 items
SELECT COUNT(*) FROM feature;       -- Should show ~319 features
SELECT COUNT(*) FROM target_audience; -- Should show ~10 audiences

# Test full-text search index
SELECT name FROM item
WHERE to_tsvector('english', name || ' ' || COALESCE(description, ''))
  @@ to_tsquery('english', 'security')
LIMIT 5;

# Exit
\q
```

**✅ Database setup complete!**

---

## Environment Variables

### Backend Environment Variables

Create a Kubernetes Secret and ConfigMap with these variables:

#### **Sensitive Variables (Kubernetes Secret)**

```bash
# Application
NODE_ENV=production                    # Environment: production, staging, or development
PORT=3000                             # Application port (default: 3000)

# Database Configuration (On-Premise PostgreSQL)
DB_HOST=your-postgres-host            # PostgreSQL hostname or IP
DB_PORT=5432                          # PostgreSQL port
DB_NAME=converge_staging_db           # Database name
DB_USER=postgres                      # Database username
DB_PASSWORD=your-secure-password      # Database password (CHANGE THIS!)
DB_SSL=false                          # Set to 'false' for on-premise (or 'true' with SSL config)

# AI Service
GOOGLE_GEMINI_API_KEY=your-gemini-api-key   # Get from https://ai.google.dev/
```

#### **Non-Sensitive Variables (Kubernetes ConfigMap)**

```bash
# Cloud Provider Configuration
CLOUD_PROVIDER=aws                    # Keep as 'aws' for compatibility

# Google Cloud Configuration (for AI services only)
GCP_PROJECT_ID=your-gcp-project-id    # Optional: for Vertex AI integration
VERTEX_AI_LOCATION=us-central1        # Optional: for Vertex AI
```

#### **Variable Descriptions**

| Variable                | Required | Description                        | Example                   |
| ----------------------- | -------- | ---------------------------------- | ------------------------- |
| `NODE_ENV`              | Yes      | Application environment            | `production`              |
| `PORT`                  | No       | Application port (default: 3000)   | `3000`                    |
| `DB_HOST`               | Yes      | PostgreSQL hostname                | `postgres.internal.local` |
| `DB_PORT`               | No       | PostgreSQL port (default: 5432)    | `5432`                    |
| `DB_NAME`               | Yes      | Database name                      | `converge_staging_db`     |
| `DB_USER`               | Yes      | Database username                  | `postgres`                |
| `DB_PASSWORD`           | Yes      | Database password                  | `SecureP@ssw0rd!`         |
| `DB_SSL`                | No       | Enable SSL for DB (default: false) | `false`                   |
| `GOOGLE_GEMINI_API_KEY` | Yes      | Google Gemini API key              | `AIzaSy...`               |
| `CLOUD_PROVIDER`        | No       | Cloud provider identifier          | `aws`                     |
| `GCP_PROJECT_ID`        | No       | Google Cloud project ID            | `my-project-id`           |

#### **How to Get Google Gemini API Key**

1. Visit https://ai.google.dev/
2. Sign in with your Google account
3. Navigate to "Get API Key"
4. Create a new API key
5. Copy the key (format: `AIzaSy...`)

**Important:** Keep this API key secure! Store it in Kubernetes Secrets, never in code.

### Frontend Environment Variables

The frontend requires **build-time** environment variables (they get baked into the Next.js bundle during Docker build).

#### **Build Arguments (Docker Build Time)**

```bash
# Backend API URL (REST endpoints)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# WebSocket URL (real-time chat)
NEXT_PUBLIC_SOCKET_URL=wss://api.yourdomain.com
```

#### **Variable Descriptions**

| Variable                 | Required | Description           | Example                   |
| ------------------------ | -------- | --------------------- | ------------------------- |
| `NEXT_PUBLIC_API_URL`    | Yes      | Backend API base URL  | `https://api.example.com` |
| `NEXT_PUBLIC_SOCKET_URL` | Yes      | Backend WebSocket URL | `wss://api.example.com`   |

#### **Important Notes**

1. **Protocol Selection:**

   - For **HTTPS** deployments: Use `https://` for API and `wss://` for WebSocket
   - For **HTTP** deployments: Use `http://` for API and `ws://` for WebSocket
   - **Never mix protocols** (e.g., https with ws) - it will fail on mobile browsers

2. **Build-Time Only:**

   - These variables are embedded during Docker build
   - Changes require rebuilding the Docker image
   - Cannot be changed with Kubernetes ConfigMap/Secret at runtime

3. **Auto-Correction:**
   - The frontend automatically corrects WebSocket protocol mismatches
   - If page is HTTPS but socket is `ws://`, it auto-converts to `wss://`
   - This prevents mobile browser "mixed content" errors

---

## Docker Image Build

### Backend Image Build

**Location:** `converge-global-be/`

**Dockerfile:** Uses Node.js latest, compiles TypeScript to JavaScript

```bash
# Navigate to backend directory
cd converge-global-be

# Build the Docker image
docker build -t your-registry/converge-backend:latest .

# Tag for specific version
docker tag your-registry/converge-backend:latest \
  your-registry/converge-backend:v1.0.0

# Push to registry
docker push your-registry/converge-backend:latest
docker push your-registry/converge-backend:v1.0.0
```

**What the Dockerfile does:**

1. Uses `node:latest` base image
2. Copies `package.json` and `package-lock.json`
3. Runs `npm install` (production dependencies)
4. Copies all source code
5. Runs `npm run build` (TypeScript compilation)
6. Exposes port 3000
7. Runs `npm start` (production server)

**Build output:** Compiled JavaScript in `/usr/src/app/dist/`

### Frontend Image Build

**Location:** `converge-global-fe/`

**Dockerfile:** Multi-stage build with Next.js optimization

```bash
# Navigate to frontend directory
cd converge-global-fe

# Build with environment variables (IMPORTANT!)
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://api.yourdomain.com \
  -t your-registry/converge-frontend:latest .

# Tag for specific version
docker tag your-registry/converge-frontend:latest \
  your-registry/converge-frontend:v1.0.0

# Push to registry
docker push your-registry/converge-frontend:latest
docker push your-registry/converge-frontend:v1.0.0
```

**What the Dockerfile does:**

**Stage 1 (Builder):**

1. Uses `node:20-alpine` base image
2. Accepts build arguments (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`)
3. Copies `package.json` and `package-lock.json`
4. Runs `npm install`
5. Copies all source code
6. Runs `npm run build` (Next.js production build with env vars baked in)

**Stage 2 (Runner):**

1. Uses clean `node:20-alpine` image
2. Copies only built artifacts from Stage 1 (`.next/`, `node_modules/`, `public/`)
3. Exposes port 3000
4. Runs `npm start` (Next.js production server)

**Build output:** Optimized Next.js bundle in `.next/`

### Image Tagging Best Practices

**Recommended tagging strategy:**

```bash
# Git commit SHA (for traceability)
docker tag your-registry/converge-backend:latest \
  your-registry/converge-backend:git-abc1234

# Semantic version
docker tag your-registry/converge-backend:latest \
  your-registry/converge-backend:v1.2.3

# Environment-specific
docker tag your-registry/converge-backend:latest \
  your-registry/converge-backend:staging-2024-11-19

# Latest (for convenience)
docker tag your-registry/converge-backend:latest \
  your-registry/converge-backend:latest
```

**Use semantic versioning in production:**

- `v1.0.0` - Major version (breaking changes)
- `v1.1.0` - Minor version (new features)
- `v1.1.1` - Patch version (bug fixes)

### Multi-Architecture Builds (Optional)

If deploying to ARM-based Kubernetes nodes:

```bash
# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-registry/converge-backend:latest \
  --push .
```

---

## Kubernetes Deployment

See **[kubernetes-manifests.md](./kubernetes-manifests.md)** for complete YAML files.

### Deployment Order

Deploy resources in this order to ensure dependencies are met:

```bash
# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Create ConfigMaps and Secrets
kubectl apply -f backend-configmap.yaml
kubectl apply -f backend-secret.yaml

# 3. Deploy backend
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml

# 4. Deploy frontend
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml

# 5. Create Ingress
kubectl apply -f ingress.yaml
```

### Quick Deployment Script

```bash
#!/bin/bash
# deploy.sh - Deploy Converge to Kubernetes

set -e

echo "🚀 Deploying Converge to Kubernetes..."

# Set namespace
NAMESPACE="converge"

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply all manifests
kubectl apply -f k8s/ -n $NAMESPACE

# Wait for deployments to be ready
echo "⏳ Waiting for backend deployment..."
kubectl rollout status deployment/converge-backend -n $NAMESPACE --timeout=300s

echo "⏳ Waiting for frontend deployment..."
kubectl rollout status deployment/converge-frontend -n $NAMESPACE --timeout=300s

echo "✅ Deployment complete!"

# Show service URLs
echo ""
echo "📋 Service Information:"
kubectl get services -n $NAMESPACE
echo ""
kubectl get ingress -n $NAMESPACE
```

### Staging Branch Auto-Deployment

Configure your CI/CD system to:

1. **Trigger on push to `staging` branch**
2. **Build Docker images** with unique tags (e.g., git SHA)
3. **Push to registry**
4. **Update Kubernetes deployments** with new image tags

**Generic CI/CD steps:**

```yaml
# Pseudo-code for CI/CD pipeline
on:
  push:
    branches:
      - staging

jobs:
  deploy:
    steps:
      - name: Build Backend Image
        run: |
          docker build -t registry/converge-backend:${GIT_SHA} ./converge-global-be
          docker push registry/converge-backend:${GIT_SHA}

      - name: Build Frontend Image
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_API_URL=${API_URL} \
            --build-arg NEXT_PUBLIC_SOCKET_URL=${SOCKET_URL} \
            -t registry/converge-frontend:${GIT_SHA} \
            ./converge-global-fe
          docker push registry/converge-frontend:${GIT_SHA}

      - name: Update Kubernetes Deployment
        run: |
          kubectl set image deployment/converge-backend \
            converge-backend=registry/converge-backend:${GIT_SHA} \
            -n converge

          kubectl set image deployment/converge-frontend \
            converge-frontend=registry/converge-frontend:${GIT_SHA} \
            -n converge

      - name: Wait for Rollout
        run: |
          kubectl rollout status deployment/converge-backend -n converge
          kubectl rollout status deployment/converge-frontend -n converge
```

---

## Post-Deployment Verification

### 1. Check Pod Status

```bash
# List all pods
kubectl get pods -n converge

# Expected output:
# NAME                                 READY   STATUS    RESTARTS   AGE
# converge-backend-xxxxxxxxxx-xxxxx    1/1     Running   0          2m
# converge-frontend-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
```

### 2. Check Pod Logs

```bash
# Backend logs
kubectl logs -f deployment/converge-backend -n converge

# Expected output:
# Initializing database connection pool...
# Setting up direct PostgreSQL connection (AWS/RDS)...
# Testing database connection...
# ✅ Database connected successfully: { now: '2024-11-19...' }
# ✅ Database pool initialization complete.
# Server is running on port 3000

# Frontend logs
kubectl logs -f deployment/converge-frontend -n converge

# Expected output:
# ▲ Next.js 15.x.x
# - Local:        http://0.0.0.0:3000
# - Ready in Xms
```

### 3. Test Backend Health

```bash
# Port-forward to backend
kubectl port-forward -n converge deployment/converge-backend 3000:3000

# In another terminal, test endpoints
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-11-19T..."}
```

### 4. Test Database Connectivity

```bash
# Check backend can connect to database
kubectl exec -it -n converge deployment/converge-backend -- \
  npm run db:push

# Expected output (if schema is up to date):
# Everything is up to date
```

### 5. Test Frontend Access

```bash
# Port-forward to frontend
kubectl port-forward -n converge deployment/converge-frontend 3001:3000

# Open browser
open http://localhost:3001
```

### 6. Test WebSocket Connection

```bash
# Check WebSocket connectivity through Ingress
# Open browser console on frontend and look for:
# ✅ [Socket] Connected successfully!

# Or use wscat
npm install -g wscat
wscat -c wss://api.yourdomain.com/socket.io/?EIO=4&transport=websocket
```

### 7. Verify Ingress

```bash
# Check Ingress status
kubectl get ingress -n converge

# Expected output:
# NAME                CLASS   HOSTS              ADDRESS        PORTS     AGE
# converge-ingress    nginx   yourdomain.com     x.x.x.x        80, 443   5m
```

### 8. Test Complete Flow

```bash
# Test the full application flow
curl https://yourdomain.com/api/health        # Backend health
curl https://yourdomain.com                   # Frontend HTML

# Test chat API
curl -X POST https://yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "sessionId": "test-123"}'
```

---

## Troubleshooting

### Pod Not Starting

**Symptoms:**

- Pod status: `CrashLoopBackOff`, `Error`, or `ImagePullBackOff`

**Diagnosis:**

```bash
# Check pod events
kubectl describe pod -n converge <pod-name>

# Check logs
kubectl logs -n converge <pod-name>
```

**Common Issues:**

1. **ImagePullBackOff:**

   - Check Docker registry authentication
   - Verify image name and tag
   - Ensure registry credentials are in Kubernetes Secret

2. **Database Connection Error:**

   - Verify `DB_HOST` is reachable from pods
   - Check database credentials
   - Test connection: `kubectl run -it --rm psql-test --image=postgres:16 -- psql -h DB_HOST -U postgres`

3. **Missing Environment Variables:**
   - Check ConfigMap and Secret are applied
   - Verify env vars in deployment: `kubectl get deployment converge-backend -n converge -o yaml | grep -A 20 env:`

### WebSocket Connection Failing

**Symptoms:**

- Frontend can't establish WebSocket connection
- Console errors: "WebSocket connection failed"

**Diagnosis:**

```bash
# Check Ingress annotations for WebSocket support
kubectl get ingress converge-ingress -n converge -o yaml | grep -A 5 annotations

# Should include:
# nginx.ingress.kubernetes.io/websocket-services: converge-backend
```

**Solutions:**

1. **Add WebSocket headers to Ingress** (see kubernetes-manifests.md)
2. **Check protocol mismatch:** HTTPS page needs `wss://`, not `ws://`
3. **Verify backend service** exposes port 3000

### Database Migration Issues

**Symptoms:**

- Application starts but queries fail
- Missing tables or columns errors

**Solutions:**

```bash
# Re-run database schema
kubectl exec -it -n converge deployment/converge-backend -- bash
cd /usr/src/app
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < docs/db-scripts/init-database-20260407.sql
```

### Performance Issues

**Symptoms:**

- Slow response times
- High CPU/memory usage

**Diagnosis:**

```bash
# Check resource usage
kubectl top pods -n converge

# Check limits
kubectl describe pod -n converge <pod-name> | grep -A 10 "Limits:"
```

**Solutions:**

1. **Increase resource limits** in deployment YAML
2. **Scale replicas:** `kubectl scale deployment converge-backend -n converge --replicas=3`
3. **Check database performance:** Slow queries, missing indexes
4. **Add database connection pooling:** Already configured in Drizzle ORM

### Logs Investigation

**Backend detailed logs:**

```bash
# Follow logs with timestamps
kubectl logs -f -n converge deployment/converge-backend --timestamps

# Get logs from all replicas
kubectl logs -n converge -l app=converge-backend --tail=100

# Get logs for specific time range
kubectl logs -n converge deployment/converge-backend --since=1h
```

**Frontend detailed logs:**

```bash
# Follow logs
kubectl logs -f -n converge deployment/converge-frontend --timestamps

# Check build logs (if debugging startup)
kubectl logs -n converge <pod-name> --previous
```

### Health Check Failures

**Symptoms:**

- Pods restart frequently
- Readiness probe failures

**Diagnosis:**

```bash
# Check probe configuration
kubectl describe pod -n converge <pod-name> | grep -A 5 "Liveness\|Readiness"
```

**Solutions:**

1. **Increase initial delay:** Give app more time to start
2. **Adjust failure threshold:** Allow more failed checks before restart
3. **Verify health endpoint:** `curl http://localhost:3000/api/health` from within pod

### Get Support

**Documentation:**

- Database: [db-docs.md](./db-docs.md)
- Architecture: [overall-architecture.md](./overall-architecture.md)
- CI/CD: [cicd-docs.md](./cicd-docs.md)
- LangChain/AI: [langchain-docs.md](./langchain-docs.md)

**Logs to Collect:**

```bash
# Create support bundle
kubectl logs -n converge deployment/converge-backend > backend-logs.txt
kubectl logs -n converge deployment/converge-frontend > frontend-logs.txt
kubectl describe pods -n converge > pod-details.txt
kubectl get events -n converge > events.txt
```

---

**Document Maintained By:** DevOps Team  
**Last Updated:** November 19, 2025  
**Next Review:** Quarterly or upon infrastructure changes
