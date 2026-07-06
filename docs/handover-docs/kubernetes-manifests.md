# Kubernetes Manifests

**Purpose:** Complete Kubernetes YAML manifests for deploying Converge Global application

**Last Updated:** November 19, 2025

---

## Table of Contents

1. [Namespace](#namespace)
2. [Backend Resources](#backend-resources)
3. [Frontend Resources](#frontend-resources)
4. [Ingress Configuration](#ingress-configuration)
5. [Resource Limits Guidelines](#resource-limits-guidelines)
6. [Scaling Configuration](#scaling-configuration)

---

## Namespace

Create a dedicated namespace for the Converge application:

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: converge
  labels:
    name: converge
    environment: staging
```

**Apply:**
```bash
kubectl apply -f namespace.yaml
```

---

## Backend Resources

### Backend ConfigMap

Non-sensitive configuration for the backend application:

```yaml
# backend-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: converge-backend-config
  namespace: converge
data:
  # Application Configuration
  NODE_ENV: "production"
  PORT: "3000"
  
  # Cloud Provider Configuration
  CLOUD_PROVIDER: "aws"
  
  # Database Configuration (non-sensitive)
  DB_PORT: "5432"
  DB_NAME: "converge_staging_db"
  DB_SSL: "false"
  
  # Optional: Google Cloud Configuration (for AI services)
  GCP_PROJECT_ID: "your-gcp-project-id"
  VERTEX_AI_LOCATION: "us-central1"
```

**Apply:**
```bash
kubectl apply -f backend-configmap.yaml
```

### Backend Secret

Sensitive credentials for the backend application:

```yaml
# backend-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: converge-backend-secret
  namespace: converge
type: Opaque
stringData:
  # Database Credentials
  DB_HOST: "your-postgres-host.internal.local"
  DB_USER: "postgres"
  DB_PASSWORD: "your-secure-database-password"
  
  # Google Gemini API Key
  GOOGLE_GEMINI_API_KEY: "your-google-gemini-api-key"
```

**⚠️ IMPORTANT SECURITY NOTES:**

1. **Never commit secrets to Git!** Use `.gitignore` to exclude secret files
2. **Use base64 encoding** if using `data:` instead of `stringData:`
3. **Consider external secret management:**
   - HashiCorp Vault
   - AWS Secrets Manager (with External Secrets Operator)
   - Sealed Secrets
   - SOPS (Secrets OPerationS)

**Apply:**
```bash
# Apply directly (for initial setup)
kubectl apply -f backend-secret.yaml

# OR create from command line (more secure)
kubectl create secret generic converge-backend-secret \
  --from-literal=DB_HOST=your-postgres-host \
  --from-literal=DB_USER=postgres \
  --from-literal=DB_PASSWORD=your-password \
  --from-literal=GOOGLE_GEMINI_API_KEY=your-api-key \
  -n converge
```

### Backend Deployment

Main backend application deployment:

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: converge-backend
  namespace: converge
  labels:
    app: converge-backend
    tier: backend
spec:
  replicas: 2  # Start with 2 replicas for high availability
  selector:
    matchLabels:
      app: converge-backend
  template:
    metadata:
      labels:
        app: converge-backend
        tier: backend
    spec:
      # Security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      
      # Image pull secrets (if using private registry)
      imagePullSecrets:
        - name: registry-credentials
      
      containers:
      - name: converge-backend
        image: your-registry/converge-backend:latest  # CHANGE THIS
        imagePullPolicy: Always
        
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        
        # Environment variables from ConfigMap
        envFrom:
        - configMapRef:
            name: converge-backend-config
        
        # Environment variables from Secret
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: converge-backend-secret
              key: DB_HOST
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: converge-backend-secret
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: converge-backend-secret
              key: DB_PASSWORD
        - name: GOOGLE_GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: converge-backend-secret
              key: GOOGLE_GEMINI_API_KEY
        
        # Resource limits and requests
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        
        # Liveness probe (restart if unhealthy)
        livenessProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Readiness probe (don't send traffic if not ready)
        readinessProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        
        # Startup probe (give more time for initial startup)
        startupProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 0
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30  # 30 * 5 = 150 seconds max startup time
        
        # Security context for container
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false  # Node.js needs write access
          capabilities:
            drop:
              - ALL
      
      # Restart policy
      restartPolicy: Always
      
      # DNS policy
      dnsPolicy: ClusterFirst
```

**Apply:**
```bash
kubectl apply -f backend-deployment.yaml

# Watch rollout status
kubectl rollout status deployment/converge-backend -n converge
```

### Backend Service

Expose the backend application within the cluster:

```yaml
# backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: converge-backend
  namespace: converge
  labels:
    app: converge-backend
    tier: backend
spec:
  type: ClusterIP  # Internal service only
  selector:
    app: converge-backend
  ports:
  - name: http
    port: 3000
    targetPort: http
    protocol: TCP
  sessionAffinity: None  # Use ClientIP for sticky sessions if needed
```

**Apply:**
```bash
kubectl apply -f backend-service.yaml

# Verify service
kubectl get service converge-backend -n converge
```

---

## Frontend Resources

### Frontend Deployment

Main frontend application deployment:

```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: converge-frontend
  namespace: converge
  labels:
    app: converge-frontend
    tier: frontend
spec:
  replicas: 2  # Start with 2 replicas for high availability
  selector:
    matchLabels:
      app: converge-frontend
  template:
    metadata:
      labels:
        app: converge-frontend
        tier: frontend
    spec:
      # Security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      
      # Image pull secrets (if using private registry)
      imagePullSecrets:
        - name: registry-credentials
      
      containers:
      - name: converge-frontend
        # IMPORTANT: Image must be built with build args
        # docker build --build-arg NEXT_PUBLIC_API_URL=... --build-arg NEXT_PUBLIC_SOCKET_URL=...
        image: your-registry/converge-frontend:latest  # CHANGE THIS
        imagePullPolicy: Always
        
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        
        # Resource limits and requests
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        
        # Liveness probe
        livenessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Readiness probe
        readinessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        
        # Startup probe
        startupProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 0
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30
        
        # Security context
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false
          capabilities:
            drop:
              - ALL
      
      restartPolicy: Always
      dnsPolicy: ClusterFirst
```

**Apply:**
```bash
kubectl apply -f frontend-deployment.yaml

# Watch rollout status
kubectl rollout status deployment/converge-frontend -n converge
```

### Frontend Service

Expose the frontend application within the cluster:

```yaml
# frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: converge-frontend
  namespace: converge
  labels:
    app: converge-frontend
    tier: frontend
spec:
  type: ClusterIP  # Internal service only
  selector:
    app: converge-frontend
  ports:
  - name: http
    port: 3000
    targetPort: http
    protocol: TCP
  sessionAffinity: None
```

**Apply:**
```bash
kubectl apply -f frontend-service.yaml

# Verify service
kubectl get service converge-frontend -n converge
```

---

## Ingress Configuration

### Nginx Ingress Controller

**Prerequisites:**
- Nginx Ingress Controller installed in cluster
- SSL/TLS certificates (for HTTPS)

**Install Nginx Ingress Controller (if not already installed):**

```bash
# Using Helm
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Or using kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

### Ingress with WebSocket Support

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: converge-ingress
  namespace: converge
  annotations:
    # Nginx Ingress Controller annotations
    kubernetes.io/ingress.class: "nginx"
    
    # WebSocket support (CRITICAL for chat functionality)
    nginx.ingress.kubernetes.io/websocket-services: "converge-backend"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    
    # Connection upgrade headers for WebSocket
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_http_version 1.1;
    
    # SSL/TLS configuration
    cert-manager.io/cluster-issuer: "letsencrypt-prod"  # If using cert-manager
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    
    # Security headers
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/hsts: "true"
    nginx.ingress.kubernetes.io/hsts-max-age: "31536000"
    
    # Rate limiting (optional)
    nginx.ingress.kubernetes.io/limit-rps: "100"
    
    # CORS (if needed)
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization"
spec:
  tls:
  - hosts:
    - yourdomain.com
    - www.yourdomain.com
    - api.yourdomain.com
    secretName: converge-tls-secret  # TLS certificate secret
  
  rules:
  # Frontend (main domain)
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: converge-frontend
            port:
              number: 3000
  
  # Frontend (www subdomain)
  - host: www.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: converge-frontend
            port:
              number: 3000
  
  # Backend API (api subdomain)
  - host: api.yourdomain.com
    http:
      paths:
      # Backend API routes
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: converge-backend
            port:
              number: 3000
      
      # WebSocket endpoint (IMPORTANT)
      - path: /socket.io
        pathType: Prefix
        backend:
          service:
            name: converge-backend
            port:
              number: 3000
```

**Apply:**
```bash
kubectl apply -f ingress.yaml

# Verify Ingress
kubectl get ingress -n converge
kubectl describe ingress converge-ingress -n converge
```

### Alternative: Single Domain with Path-Based Routing

If you prefer a single domain:

```yaml
# ingress-single-domain.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: converge-ingress
  namespace: converge
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/websocket-services: "converge-backend"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_http_version 1.1;
spec:
  tls:
  - hosts:
    - yourdomain.com
    secretName: converge-tls-secret
  
  rules:
  - host: yourdomain.com
    http:
      paths:
      # Backend routes (higher priority, more specific paths first)
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: converge-backend
            port:
              number: 3000
      
      - path: /socket.io
        pathType: Prefix
        backend:
          service:
            name: converge-backend
            port:
              number: 3000
      
      # Frontend (catch-all, lowest priority)
      - path: /
        pathType: Prefix
        backend:
          service:
            name: converge-frontend
            port:
              number: 3000
```

### TLS Certificate Setup

#### Option 1: Using Cert-Manager (Recommended)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

#### Option 2: Manual Certificate

```bash
# Create TLS secret from certificate files
kubectl create secret tls converge-tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n converge
```

---

## Resource Limits Guidelines

### Backend Resource Sizing

**Small deployment (development/testing):**
```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

**Medium deployment (staging):**
```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

**Large deployment (production):**
```yaml
resources:
  requests:
    cpu: 1000m
    memory: 1Gi
  limits:
    cpu: 4000m
    memory: 4Gi
```

### Frontend Resource Sizing

**Small deployment:**
```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

**Medium deployment (recommended):**
```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

**Large deployment:**
```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

### Resource Calculation

**Total cluster requirements:**

For 2 replicas of each service (medium deployment):
- **CPU**: (500m + 250m) × 2 = 1.5 vCPU (requests)
- **Memory**: (512Mi + 256Mi) × 2 = 1.5 GB (requests)
- **Overhead**: Add 20-30% for Kubernetes system components

**Recommended minimum cluster:**
- 3 nodes × 2 vCPU = 6 vCPU
- 3 nodes × 4 GB RAM = 12 GB RAM

---

## Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

Automatically scale based on CPU/memory usage:

```yaml
# backend-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: converge-backend-hpa
  namespace: converge
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: converge-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 minutes before scaling down
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60  # Scale down max 50% per minute
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30  # Scale up fast (double every 30s)
      - type: Pods
        value: 4
        periodSeconds: 30  # Or add 4 pods every 30s
      selectPolicy: Max
```

```yaml
# frontend-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: converge-frontend-hpa
  namespace: converge
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: converge-frontend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      selectPolicy: Max
```

**Apply:**
```bash
kubectl apply -f backend-hpa.yaml
kubectl apply -f frontend-hpa.yaml

# Verify HPA
kubectl get hpa -n converge
```

### Manual Scaling

Scale deployments manually:

```bash
# Scale backend to 5 replicas
kubectl scale deployment converge-backend --replicas=5 -n converge

# Scale frontend to 3 replicas
kubectl scale deployment converge-frontend --replicas=3 -n converge

# Verify scaling
kubectl get deployments -n converge
```

### Pod Disruption Budget (PDB)

Ensure minimum availability during maintenance:

```yaml
# backend-pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: converge-backend-pdb
  namespace: converge
spec:
  minAvailable: 1  # Always keep at least 1 pod running
  selector:
    matchLabels:
      app: converge-backend
```

```yaml
# frontend-pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: converge-frontend-pdb
  namespace: converge
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: converge-frontend
```

**Apply:**
```bash
kubectl apply -f backend-pdb.yaml
kubectl apply -f frontend-pdb.yaml

# Verify PDB
kubectl get pdb -n converge
```

---

## Complete Deployment Script

Save all manifests in a `k8s/` directory and use this script:

```bash
#!/bin/bash
# deploy-all.sh - Complete deployment script

set -e

NAMESPACE="converge"
REGISTRY="your-registry"
BACKEND_IMAGE="${REGISTRY}/converge-backend:latest"
FRONTEND_IMAGE="${REGISTRY}/converge-frontend:latest"

echo "🚀 Deploying Converge to Kubernetes..."

# Create namespace
echo "📦 Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMap and Secrets
echo "🔧 Applying configuration..."
kubectl apply -f k8s/backend-configmap.yaml
kubectl apply -f k8s/backend-secret.yaml

# Deploy backend
echo "🔨 Deploying backend..."
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Deploy frontend
echo "🎨 Deploying frontend..."
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# Deploy Ingress
echo "🌐 Creating Ingress..."
kubectl apply -f k8s/ingress.yaml

# Apply HPA (optional)
if [ -f k8s/backend-hpa.yaml ]; then
  echo "📊 Configuring autoscaling..."
  kubectl apply -f k8s/backend-hpa.yaml
  kubectl apply -f k8s/frontend-hpa.yaml
fi

# Apply PDB (optional)
if [ -f k8s/backend-pdb.yaml ]; then
  echo "🛡️  Configuring disruption budgets..."
  kubectl apply -f k8s/backend-pdb.yaml
  kubectl apply -f k8s/frontend-pdb.yaml
fi

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl rollout status deployment/converge-backend -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/converge-frontend -n $NAMESPACE --timeout=300s

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Service Information:"
kubectl get pods,services,ingress -n $NAMESPACE
echo ""
echo "🔍 Check logs:"
echo "  Backend:  kubectl logs -f deployment/converge-backend -n $NAMESPACE"
echo "  Frontend: kubectl logs -f deployment/converge-frontend -n $NAMESPACE"
```

---

**Document Maintained By:** DevOps Team  
**Last Updated:** November 19, 2025  
**Next Review:** Quarterly or upon infrastructure changes

