# Handover Documentation

**Purpose:** Complete technical documentation for deploying and maintaining Converge Global

**Last Updated:** November 19, 2025

---

## 📚 Documentation Index

### Getting Started

Start here if you're new to the project:

1. **[Overall Architecture](./overall-architecture.md)** ⭐
   - System overview and component architecture
   - Technology stack
   - Data flow and design decisions
   - Recommended first read

### Database Setup

2. **[Client Handover Quick Start](./CLIENT-HANDOVER-QUICKSTART.md)** 🚀 START HERE
   - **3-step setup guide (45 minutes)**
   - Quick commands and summaries
   - Common issues and fixes
   - **Perfect for first-time setup with existing frontend**

3. **[On-Premise Database Setup](./on-premise-database-setup.md)** 🎯 COMPLETE GUIDE
   - **Detailed guide for on-premise PostgreSQL setup**
   - Step-by-step installation (Ubuntu/CentOS/macOS/Docker)
   - Database initialization and seeding
   - Backend configuration and deployment
   - Testing and verification
   - Maintenance and troubleshooting
   - **Comprehensive reference for all topics**

4. **[Database Documentation](./db-docs.md)**
   - PostgreSQL setup and configuration
   - Schema initialization
   - Database seeding
   - Migrations and maintenance
   - Backup and recovery

### Deployment Guides

#### For AWS Deployment

3. **[AWS & Terraform Documentation](./aws-terraform-docs.md)**
   - AWS infrastructure setup with Terraform
   - ECS, RDS, ALB configuration
   - Secrets management
   - Cost optimization

4. **[CI/CD Documentation](./cicd-docs.md)**
   - GitHub Actions and AWS CodeBuild setup
   - Automated deployment pipelines
   - Deployment strategies

#### For Kubernetes Deployment (On-Premise/Any Cloud)

5. **[Kubernetes Deployment Guide](./kubernetes-deployment-guide.md)** 🚀 NEW
   - Complete K8s deployment walkthrough
   - Database setup for on-premise PostgreSQL
   - Environment variables configuration
   - Docker image building
   - Post-deployment verification
   - Troubleshooting guide

6. **[Kubernetes Manifests](./kubernetes-manifests.md)** 🚀 NEW
   - Ready-to-use YAML configurations
   - Backend and Frontend deployments
   - ConfigMaps and Secrets
   - Ingress with WebSocket support
   - Horizontal Pod Autoscaler (HPA)
   - Resource limits and scaling

7. **[Deployment Checklist](./deployment-checklist.md)** 🚀 NEW
   - Quick reference guide
   - Step-by-step deployment checklist
   - Common issues and quick fixes
   - Essential commands
   - CI/CD integration for staging branch

### AI & Features

8. **[LangChain Documentation](./langchain-docs.md)**
   - AI chatbot implementation
   - Google Gemini integration
   - Streaming responses
   - Prompt engineering

---

## 🎯 Quick Navigation by Use Case

### "I have frontend deployed, need to set up backend database" ⭐ MOST COMMON

**Start here:**
1. Follow [Client Handover Quick Start](./CLIENT-HANDOVER-QUICKSTART.md) - 3-step guide ⚡
2. For detailed explanations, see [On-Premise Database Setup](./on-premise-database-setup.md)
3. Refer to [Database Documentation](./db-docs.md) for advanced topics

**Estimated time:** 30-45 minutes (first-time setup)

**✅ This is the recommended path for client handover**

**Two guides available:**
- **Quick Start**: Fast setup with essential commands
- **Complete Guide**: Detailed explanations and all options

### "I need to deploy to Kubernetes"

**Start here:**
1. Read [Deployment Checklist](./deployment-checklist.md) for overview
2. Follow [Kubernetes Deployment Guide](./kubernetes-deployment-guide.md) for detailed steps
3. Use [Kubernetes Manifests](./kubernetes-manifests.md) for YAML configurations
4. Refer to [Database Documentation](./db-docs.md) for database setup

**Estimated time:** 45 minutes (first-time deployment)

### "I need to deploy to AWS"

**Start here:**
1. Read [Overall Architecture](./overall-architecture.md) for context
2. Follow [AWS & Terraform Documentation](./aws-terraform-docs.md) for infrastructure
3. Set up [CI/CD Documentation](./cicd-docs.md) for automation
4. Refer to [Database Documentation](./db-docs.md) for RDS setup

**Estimated time:** 2-3 hours (first-time deployment)

### "I need to understand the system"

**Start here:**
1. [Overall Architecture](./overall-architecture.md) - System design
2. [Database Documentation](./db-docs.md) - Data structure
3. [LangChain Documentation](./langchain-docs.md) - AI features

**Estimated time:** 30-45 minutes (reading)

### "I need to set up CI/CD for staging branch"

**Start here:**
1. [Deployment Checklist](./deployment-checklist.md) - See "Staging Branch CI/CD Setup" section
2. [CI/CD Documentation](./cicd-docs.md) - Detailed pipeline configuration
3. [Kubernetes Manifests](./kubernetes-manifests.md) - Deployment configurations

**Estimated time:** 1-2 hours

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│                    React + TypeScript                        │
└────────────────────┬───────────────────┬────────────────────┘
                     │ HTTP/REST         │ WebSocket (Socket.IO)
                     │                   │
                     ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express.js Server                           │
│  - REST API endpoints                                        │
│  - Socket.IO WebSocket handlers                              │
│  - Middleware (auth, logging, error handling)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  - ChatService (conversation orchestration)                  │
│  - LangChainService (AI integration)                         │
│  - ItemSearchService (product search)                        │
│  - ItemService (CRUD operations)                             │
│  - CartService (shopping cart)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Database (PostgreSQL 16.8)                     │
│  - Items (solutions, categories, products)                   │
│  - Chat sessions & conversations                             │
│  - Cart data & user selections                               │
│  - Target audiences & sales leads                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Information

### Technology Stack

| Component     | Technology      | Version |
| ------------- | --------------- | ------- |
| Runtime       | Node.js         | 20+     |
| Language      | TypeScript      | Latest  |
| Backend       | Express.js      | 4.x     |
| Frontend      | Next.js         | 15.x    |
| Database      | PostgreSQL      | 16.8    |
| ORM           | Drizzle ORM     | Latest  |
| Real-time     | Socket.IO       | 4.x     |
| AI Model      | Google Gemini   | 2.0     |
| AI Framework  | LangChain       | Latest  |
| Container     | Docker          | Latest  |
| Orchestration | Kubernetes      | 1.24+   |

### Ports

- **Backend**: 3000 (HTTP + WebSocket)
- **Frontend**: 3000 (HTTP, runs on 3001 locally in dev)
- **Database**: 5432 (PostgreSQL)

### Environment Types

- **Development**: Local development with hot reload
- **Staging**: Kubernetes deployment from `staging` branch
- **Production**: AWS ECS or Kubernetes production cluster

---

## 📦 Repository Structure

```
converge-global-be/
├── docs/
│   ├── handover-docs/          # THIS DIRECTORY
│   │   ├── README.md           # This file (index)
│   │   ├── overall-architecture.md
│   │   ├── db-docs.md
│   │   ├── aws-terraform-docs.md
│   │   ├── cicd-docs.md
│   │   ├── langchain-docs.md
│   │   ├── kubernetes-deployment-guide.md  # NEW
│   │   ├── kubernetes-manifests.md         # NEW
│   │   └── deployment-checklist.md         # NEW
│   └── db-scripts/
│       ├── init-database-20260407.sql      # Full init script (schema + seed) ⭐
│       ├── rds-schema-20251107-093236.sql  # Legacy schema export
│       └── rds-seeding-20251107-093236.sql # Legacy seed export
├── src/                        # Source code
│   ├── controllers/
│   ├── services/
│   ├── models/
│   └── routes/
├── Dockerfile                  # Backend Docker configuration
├── package.json
└── env.aws.example             # Environment variables template

converge-global-fe/
├── app/                        # Next.js pages
├── modules/                    # Feature modules
├── components/                 # React components
├── Dockerfile                  # Frontend Docker configuration
└── package.json
```

---

## ⚡ Quick Start Commands

### Local Development

```bash
# Backend
cd converge-global-be
npm install
cp env.aws.example .env
# Edit .env with your credentials
npm run dev

# Frontend (in another terminal)
cd converge-global-fe
npm install
npm run dev
```

### Docker Build

```bash
# Backend
docker build -t converge-backend:latest converge-global-be/

# Frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://api.yourdomain.com \
  -t converge-frontend:latest converge-global-fe/
```

### Kubernetes Deployment

```bash
# Quick deployment
kubectl apply -f k8s/

# With verification
kubectl rollout status deployment/converge-backend -n converge
kubectl rollout status deployment/converge-frontend -n converge
```

---

## 🆘 Need Help?

### Common Questions

**Q: Which deployment guide should I use?**
- For AWS with ECS: Use [AWS & Terraform Documentation](./aws-terraform-docs.md)
- For Kubernetes (any cloud/on-premise): Use [Kubernetes Deployment Guide](./kubernetes-deployment-guide.md)

**Q: How do I set up the database?**
- See [Database Documentation](./db-docs.md)
- Quick start: Use the SQL files in `docs/db-scripts/`

**Q: How do I configure CI/CD for staging branch?**
- See [Deployment Checklist](./deployment-checklist.md) - "Staging Branch CI/CD Setup" section
- For AWS: See [CI/CD Documentation](./cicd-docs.md)
- For Kubernetes: Adapt the generic CI/CD template in [Deployment Checklist](./deployment-checklist.md)

**Q: How do I troubleshoot deployment issues?**
- See [Kubernetes Deployment Guide](./kubernetes-deployment-guide.md) - "Troubleshooting" section
- See [Deployment Checklist](./deployment-checklist.md) - "Common Issues & Quick Fixes"

**Q: Where are the environment variables defined?**
- Backend: See [Kubernetes Deployment Guide](./kubernetes-deployment-guide.md) - "Environment Variables" section
- Frontend: Build-time variables in Docker build command

### Support Resources

1. **Documentation** (you are here)
2. **Pod Logs**: `kubectl logs -f deployment/converge-backend -n converge`
3. **Events**: `kubectl get events -n converge --sort-by='.lastTimestamp'`
4. **Database Logs**: Check PostgreSQL server logs

---

## 📝 Documentation Maintenance

### Last Updated

- **On-Premise Database Setup: November 20, 2025** 🆕 (Client Handover)
- Overall Architecture: See file header
- Database Docs: November 7, 2025
- AWS/Terraform Docs: See file header
- CI/CD Docs: See file header
- LangChain Docs: See file header
- Kubernetes Docs: November 19, 2025

### Review Schedule

- **Quarterly**: Review all documentation
- **After major changes**: Update affected documentation
- **Before handover**: Ensure all documentation is current

### Contributing

When updating documentation:
1. Update the "Last Updated" date in each file
2. Keep code examples tested and working
3. Update this README if adding new documentation
4. Use clear, concise language
5. Include practical examples

---

## ✅ Pre-Deployment Checklist Summary

Before deploying, ensure you have:

- [ ] Read [Overall Architecture](./overall-architecture.md)
- [ ] PostgreSQL 16.8+ database ready
- [ ] Google Gemini API key obtained
- [ ] Docker images built and pushed
- [ ] Kubernetes manifests customized
- [ ] Environment variables configured
- [ ] Database initialized with schema and seed data
- [ ] SSL/TLS certificates ready (for production)

**Ready to deploy?** Start with [Deployment Checklist](./deployment-checklist.md)

---

**Document Maintained By:** DevOps & Development Team  
**Last Updated:** November 19, 2025  
**Next Review:** February 2026

