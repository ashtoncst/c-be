# Deployment Checklist

**Purpose:** Quick reference guide for deploying Converge Global to Kubernetes

**Last Updated:** April 13, 2026

---

## Staging Update — April 2026

This section covers what's changed since the last deployment and what steps are needed to update staging.

### What's New

**Backend:**
- Cart sales lead email notifications via Resend
- New `item_feature` database table (migration required)
- Chatbot improvements: discovery flow, security hardening, rate limiting
- Dependencies: added `resend`; removed `nodemailer`

**Frontend:**
- **⚠️ Next.js 15 → 16 upgrade** (breaking — requires Node.js 20+)
- Dockerfile base image changed to ECR Public Gallery (avoids Docker Hub rate limits)
- Contact form API route (`/api/contact`) with Resend email integration
- ~15 new product/service pages across Internet, Satellite, Transport, and Managed Services
- SEO additions: `robots.ts`, `sitemap.ts`, JSON-LD, error pages
- Chatbot UI redesign with discovery-first flow
- Sitewide design overhaul and mobile responsive fixes
- New dependencies: `embla-carousel`, `lucide-react`, `puppeteer`, `resend`

### New Environment Variables

**Backend** — add to ConfigMap/Secret:

```env
RESEND_API_KEY=re_xxxxxxxxxx
SALES_LEAD_RECIPIENT_EMAIL=sales@yourcompany.com
SALES_LEAD_FROM_EMAIL=noreply@yourcompany.com
SALES_LEAD_FROM_NAME=GBG Portal
```

**Frontend** — add to `.env` or build args:

```env
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourcompany.com
CONTACT_EMAIL=info@yourcompany.com
NEXT_PUBLIC_SITE_URL=https://convergeglobal.com
```

Both repos can share the same `RESEND_API_KEY`. Get yours from https://resend.com/api-keys

### Database Migration

**Option A — Incremental** (existing database, preserves data):
```bash
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME \
  -f migrations/0005_add_item_feature_table.sql
```

**Option B — Fresh re-seed** (clean database):
```bash
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME \
  -f docs/db-scripts/init-database-20260407.sql
```

### Update Procedure

- [ ] Pull latest staging code
- [ ] Run `npm install` in both backend and frontend repos
- [ ] Run database migration (Option A or B above)
- [ ] Add new backend environment variables (Resend config)
- [ ] Add new frontend environment variables (Resend + SEO)
- [ ] Rebuild Docker images (frontend Dockerfile base image changed)
- [ ] Deploy new images
- [ ] Verify: health endpoint, new pages load, chatbot works, contact form sends email

---

## Pre-Deployment Checklist

### ✅ Infrastructure Prerequisites

- [ ] Kubernetes cluster is running (v1.24+)
- [ ] kubectl is installed and configured
- [ ] Docker is installed for building images
- [ ] Access to Docker registry (with push permissions)
- [ ] Nginx Ingress Controller is installed
- [ ] SSL/TLS certificates are ready (or cert-manager is configured)
- [ ] PostgreSQL 16.8+ database is accessible from cluster
- [ ] Sufficient cluster resources available (see below)

**Minimum Cluster Resources:**
- CPU: 2 vCPU (4 vCPU recommended)
- Memory: 4 GB RAM (8 GB recommended)
- Storage: 10 GB

### ✅ Database Prerequisites

- [ ] PostgreSQL 16.8+ is installed and running
- [ ] Database `converge_staging_db` is created
- [ ] Database credentials are ready
- [ ] Network connectivity from Kubernetes pods to database verified
- [ ] Database initialization script available (`init-database-20260407.sql`)
- [ ] For existing databases: `item_feature` migration applied (`migrations/0005_add_item_feature_table.sql`)

### ✅ Required Credentials

- [ ] Google Gemini API key obtained (from https://ai.google.dev/)
- [ ] Resend API key obtained (from https://resend.com/api-keys)
- [ ] Database username and password
- [ ] Docker registry credentials
- [ ] Domain name configured (DNS pointing to cluster)

### ✅ Configuration Files Ready

- [ ] Backend ConfigMap values prepared
- [ ] Backend Secret values prepared (never commit to Git!)
- [ ] Frontend API URL decided (`NEXT_PUBLIC_API_URL`)
- [ ] Frontend WebSocket URL decided (`NEXT_PUBLIC_SOCKET_URL`)
- [ ] Kubernetes manifests reviewed and customized

---

## Deployment Steps

### Step 1: Database Setup (15 minutes)

```bash
# 1. Test database connection
psql -h YOUR_DB_HOST -p 5432 -U postgres -d postgres -c "SELECT version();"

# 2. Create database
psql -h YOUR_DB_HOST -p 5432 -U postgres -c "CREATE DATABASE converge_staging_db;"

# 3. Initialize schema and seed data (single command)
cd converge-global-be
psql -h YOUR_DB_HOST -p 5432 -U postgres -d converge_staging_db \
  < docs/db-scripts/init-database-20260407.sql

# 4. Verify
psql -h YOUR_DB_HOST -p 5432 -U postgres -d converge_staging_db \
  -c "SELECT COUNT(*) FROM item;"
# Expected: ~1044 items
```

**✅ Database ready!**

### Step 2: Build Docker Images (10 minutes)

```bash
# Backend
cd converge-global-be
docker build -t your-registry/converge-backend:v1.0.0 .
docker push your-registry/converge-backend:v1.0.0

# Frontend (with build args!)
cd ../converge-global-fe
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://api.yourdomain.com \
  -t your-registry/converge-frontend:v1.0.0 .
docker push your-registry/converge-frontend:v1.0.0
```

**✅ Images built and pushed!**

### Step 3: Prepare Kubernetes Manifests (5 minutes)

```bash
# Create k8s directory
mkdir -p k8s

# Copy and customize manifests from kubernetes-manifests.md
# Required files:
# - namespace.yaml
# - backend-configmap.yaml
# - backend-secret.yaml
# - backend-deployment.yaml
# - backend-service.yaml
# - frontend-deployment.yaml
# - frontend-service.yaml
# - ingress.yaml
```

**Update these values in manifests:**
- [ ] Image names in deployments
- [ ] Database host in backend-secret.yaml
- [ ] Database credentials in backend-secret.yaml
- [ ] Google Gemini API key in backend-secret.yaml
- [ ] Domain names in ingress.yaml
- [ ] TLS certificate secret name in ingress.yaml

**✅ Manifests ready!**

### Step 4: Deploy to Kubernetes (10 minutes)

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Apply configuration
kubectl apply -f k8s/backend-configmap.yaml
kubectl apply -f k8s/backend-secret.yaml

# 3. Deploy backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# 4. Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# 5. Create Ingress
kubectl apply -f k8s/ingress.yaml

# 6. Wait for rollout
kubectl rollout status deployment/converge-backend -n converge
kubectl rollout status deployment/converge-frontend -n converge
```

**✅ Application deployed!**

### Step 5: Verify Deployment (5 minutes)

```bash
# Check pod status
kubectl get pods -n converge
# Expected: All pods Running (1/1 Ready)

# Check services
kubectl get services -n converge

# Check Ingress
kubectl get ingress -n converge

# View backend logs
kubectl logs -f deployment/converge-backend -n converge --tail=50

# View frontend logs
kubectl logs -f deployment/converge-frontend -n converge --tail=50
```

**✅ Deployment verified!**

---

## Post-Deployment Verification

### ✅ Backend Health Check

```bash
# Port-forward test
kubectl port-forward -n converge deployment/converge-backend 3000:3000

# Test in another terminal
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### ✅ Frontend Access Test

```bash
# Port-forward test
kubectl port-forward -n converge deployment/converge-frontend 3001:3000

# Open browser
open http://localhost:3001
# Expected: Converge homepage loads
```

### ✅ Database Connection Test

```bash
# Check backend can connect to database
kubectl exec -it -n converge deployment/converge-backend -- \
  sh -c 'echo "SELECT version();" | psql -h $DB_HOST -U $DB_USER -d $DB_NAME'
# Expected: PostgreSQL version displayed
```

### ✅ WebSocket Test

```bash
# Check WebSocket through Ingress
# Open browser to: https://yourdomain.com
# Open Developer Console (F12)
# Navigate to AI Assistant / Chat
# Look for console logs:
# Expected: "✅ [Socket] Connected successfully!"
```

### ✅ End-to-End Test

1. Open https://yourdomain.com
2. Navigate to AI Assistant
3. Send a test message: "Hello"
4. Verify bot responds with AI-generated message
5. Check product search: "Show me security solutions"
6. Verify products are displayed

**✅ All tests passed!**

---

## Common Issues & Quick Fixes

### Issue: Pods not starting (CrashLoopBackOff)

**Check:**
```bash
kubectl describe pod -n converge <pod-name>
kubectl logs -n converge <pod-name>
```

**Common causes:**
- Database connection failed → Check DB_HOST, credentials
- Missing environment variables → Check ConfigMap and Secret
- Image pull failed → Check registry credentials

**Fix:**
```bash
# Fix ConfigMap/Secret and restart
kubectl rollout restart deployment/converge-backend -n converge
```

### Issue: Database connection error

**Check:**
```bash
# Test connectivity from pod
kubectl run -it --rm psql-test --image=postgres:16 -n converge -- \
  psql -h YOUR_DB_HOST -p 5432 -U postgres -d converge_staging_db
```

**Common causes:**
- Database not accessible from cluster
- Wrong credentials
- Database not initialized

**Fix:**
- Verify network connectivity
- Check firewall rules
- Re-run database setup steps

### Issue: WebSocket connection failed

**Check:**
```bash
kubectl get ingress -n converge -o yaml | grep -A 5 annotations
```

**Common causes:**
- Missing WebSocket annotations in Ingress
- Protocol mismatch (ws:// with HTTPS)
- Backend service not reachable

**Fix:**
```bash
# Ensure Ingress has WebSocket annotations
# See kubernetes-manifests.md for complete configuration
kubectl apply -f k8s/ingress.yaml
```

### Issue: Frontend shows 404 or blank page

**Check:**
```bash
kubectl logs -n converge deployment/converge-frontend --tail=100
```

**Common causes:**
- Wrong NEXT_PUBLIC_API_URL in build
- Frontend can't reach backend
- Build failed

**Fix:**
```bash
# Rebuild frontend with correct build args
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://api.yourdomain.com \
  -t your-registry/converge-frontend:v1.0.1 \
  converge-global-fe/
docker push your-registry/converge-frontend:v1.0.1

# Update deployment
kubectl set image deployment/converge-frontend \
  converge-frontend=your-registry/converge-frontend:v1.0.1 \
  -n converge
```

### Issue: SSL/TLS certificate errors

**Check:**
```bash
kubectl describe ingress converge-ingress -n converge
kubectl get certificate -n converge
```

**Common causes:**
- Certificate not issued yet (wait 2-5 minutes for cert-manager)
- Wrong certificate secret name
- DNS not pointing to cluster

**Fix:**
```bash
# If using cert-manager, check certificate status
kubectl describe certificate converge-tls-secret -n converge

# If using manual certificates, recreate secret
kubectl delete secret converge-tls-secret -n converge
kubectl create secret tls converge-tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n converge
```

---

## Scaling & Maintenance

### Scale replicas manually

```bash
# Scale up for high traffic
kubectl scale deployment converge-backend --replicas=5 -n converge
kubectl scale deployment converge-frontend --replicas=3 -n converge

# Scale down for maintenance
kubectl scale deployment converge-backend --replicas=1 -n converge
```

### Update to new version

```bash
# Build new images with version tag
docker build -t your-registry/converge-backend:v1.1.0 converge-global-be/
docker push your-registry/converge-backend:v1.1.0

# Update deployment
kubectl set image deployment/converge-backend \
  converge-backend=your-registry/converge-backend:v1.1.0 \
  -n converge

# Watch rollout
kubectl rollout status deployment/converge-backend -n converge

# Rollback if needed
kubectl rollout undo deployment/converge-backend -n converge
```

### View application logs

```bash
# Real-time logs
kubectl logs -f deployment/converge-backend -n converge
kubectl logs -f deployment/converge-frontend -n converge

# Last 100 lines
kubectl logs deployment/converge-backend -n converge --tail=100

# Logs from all replicas
kubectl logs -n converge -l app=converge-backend --tail=50
```

### Database maintenance

```bash
# Backup database
kubectl run -it --rm pg-backup --image=postgres:16 -n converge -- \
  pg_dump -h YOUR_DB_HOST -U postgres -d converge_staging_db \
  > backup_$(date +%Y%m%d).sql

# Check session cleanup logs
kubectl exec -it -n converge deployment/converge-backend -- \
  psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT * FROM session_cleanup_logs ORDER BY cleanup_timestamp DESC LIMIT 10;"
```

---

## Staging Branch CI/CD Setup

### Workflow Overview

1. Developer pushes code to `staging` branch
2. CI/CD system triggers automatically
3. Builds Docker images with unique tags (git SHA)
4. Pushes images to registry
5. Updates Kubernetes deployments
6. Waits for rollout completion
7. Runs health checks

### CI/CD Configuration Template

```yaml
# Generic CI/CD configuration (adapt to your system)
trigger:
  branch: staging

stages:
  - build
  - deploy

build:
  script:
    # Build backend
    - docker build -t registry/converge-backend:${GIT_SHA} converge-global-be/
    - docker push registry/converge-backend:${GIT_SHA}
    
    # Build frontend
    - docker build 
        --build-arg NEXT_PUBLIC_API_URL=${API_URL}
        --build-arg NEXT_PUBLIC_SOCKET_URL=${SOCKET_URL}
        -t registry/converge-frontend:${GIT_SHA} 
        converge-global-fe/
    - docker push registry/converge-frontend:${GIT_SHA}

deploy:
  script:
    # Update deployments
    - kubectl set image deployment/converge-backend 
        converge-backend=registry/converge-backend:${GIT_SHA} 
        -n converge
    - kubectl set image deployment/converge-frontend 
        converge-frontend=registry/converge-frontend:${GIT_SHA} 
        -n converge
    
    # Wait for rollout
    - kubectl rollout status deployment/converge-backend -n converge --timeout=300s
    - kubectl rollout status deployment/converge-frontend -n converge --timeout=300s
    
    # Health check
    - kubectl exec -n converge deployment/converge-backend -- 
        curl -f http://localhost:3000/api/health
```

---

## Quick Reference Commands

### Most Used Commands

```bash
# Status check
kubectl get all -n converge

# View logs
kubectl logs -f deployment/converge-backend -n converge
kubectl logs -f deployment/converge-frontend -n converge

# Restart deployments
kubectl rollout restart deployment/converge-backend -n converge
kubectl rollout restart deployment/converge-frontend -n converge

# Shell into pod
kubectl exec -it -n converge deployment/converge-backend -- /bin/sh

# Port forward for local testing
kubectl port-forward -n converge deployment/converge-backend 3000:3000

# Check resource usage
kubectl top pods -n converge

# Get full pod details
kubectl describe pod -n converge <pod-name>
```

### Emergency Commands

```bash
# Scale down (maintenance mode)
kubectl scale deployment converge-backend --replicas=0 -n converge
kubectl scale deployment converge-frontend --replicas=0 -n converge

# Rollback to previous version
kubectl rollout undo deployment/converge-backend -n converge
kubectl rollout history deployment/converge-backend -n converge

# Delete and recreate deployment
kubectl delete deployment converge-backend -n converge
kubectl apply -f k8s/backend-deployment.yaml

# Force delete stuck pod
kubectl delete pod <pod-name> -n converge --force --grace-period=0
```

---

## Resource Links

**Detailed Documentation:**
- [Kubernetes Deployment Guide](./kubernetes-deployment-guide.md) - Complete setup guide
- [Kubernetes Manifests](./kubernetes-manifests.md) - All YAML configurations
- [Database Documentation](./db-docs.md) - Database setup and management
- [Architecture Overview](./overall-architecture.md) - System architecture
- [CI/CD Documentation](./cicd-docs.md) - CI/CD setup guide

**External Resources:**
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Google Gemini API](https://ai.google.dev/)

---

## Support Contacts

**For technical issues:**
1. Check troubleshooting section above
2. Review pod logs: `kubectl logs -n converge <pod-name>`
3. Check events: `kubectl get events -n converge --sort-by='.lastTimestamp'`
4. Collect support bundle:
   ```bash
   kubectl logs -n converge deployment/converge-backend > backend-logs.txt
   kubectl logs -n converge deployment/converge-frontend > frontend-logs.txt
   kubectl describe pods -n converge > pod-details.txt
   kubectl get events -n converge > events.txt
   ```

---

**Document Maintained By:** DevOps Team  
**Last Updated:** April 13, 2026  
**Next Review:** Quarterly or upon infrastructure changes

---

## Deployment Success Criteria

- [ ] All pods show `1/1 Running` status
- [ ] Backend health endpoint returns `200 OK`
- [ ] Frontend homepage loads successfully
- [ ] WebSocket connection established (console shows "✅ [Socket] Connected")
- [ ] Chat functionality works (send message → receive AI response)
- [ ] Product search returns results
- [ ] No errors in backend logs
- [ ] No errors in frontend logs
- [ ] Database queries execute successfully
- [ ] Ingress returns correct routing
- [ ] SSL/TLS certificate is valid (HTTPS works)

**🎉 Deployment Complete!**

