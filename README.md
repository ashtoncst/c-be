# Converge Global Backend

AI-powered telecommunications product recommendation platform with real-time chatbot capabilities.

## 📖 Client Handover Documentation

**If you're setting up the backend for the first time (frontend already deployed):**

👉 **[Complete On-Premise Setup Guide](docs/handover-docs/on-premise-database-setup.md)**

This comprehensive guide includes:
- PostgreSQL installation (Ubuntu/CentOS/macOS/Docker)
- Database setup and initialization
- Backend configuration
- Testing and verification
- Troubleshooting

**Estimated time:** 30-45 minutes

---

## 🚀 Quick Start (Development)

```bash
# Install dependencies
npm install

# Set up environment (choose one)
cp env.onpremise.example .env  # For on-premise deployment
# OR
cp env.aws.example .env        # For AWS deployment

# Configure your environment variables in .env
# - Database credentials
# - Google Gemini API key
# - Frontend URL

# Run database setup
npm run db:push

# Start development server
npm run dev
```

**API Documentation**: http://localhost:3000/api/docs

## ✨ Features

- **AI Chatbot** - Real-time product recommendations powered by Gemini AI
- **WebSocket Support** - Streaming chat responses with Socket.IO
- **Product Catalog** - 3-tier hierarchy (Solution → Category → Product)
- **RESTful API** - Full CRUD operations with Swagger documentation

## 🛠️ Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js + Socket.IO
- **Database**: PostgreSQL (local/RDS)
- **ORM**: Drizzle ORM
- **AI**: Google Gemini
- **Testing**: Vitest
- **Deployment**: AWS (ECS, RDS, CodeBuild)

## 📋 Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm test             # Run tests
npm run prep         # Lint + type-check
npm run db:push      # Push schema to database
```

## 🗂️ Project Structure

```
src/
├── config/          # Database & environment config
├── controllers/     # Request handlers
├── services/        # Business logic
├── dtos/            # Data transfer objects
├── routes/          # API routes
└── handlers/        # WebSocket handlers

docs/
└── handover-docs/   # Comprehensive documentation
```

## 📚 Documentation

### For Client Handover
- **[On-Premise Database Setup](docs/handover-docs/on-premise-database-setup.md)** ⭐ Complete setup guide
- **[Handover Documentation Index](docs/handover-docs/README.md)** - All documentation

### For Development Team
- **[Database Setup](docs/handover-docs/db-docs.md)** - Schema, migrations, seeding
- **[CI/CD Guide](docs/CICD_SETUP.md)** - GitHub Actions & AWS deployment
- **[AWS Infrastructure](docs/handover-docs/aws-terraform-docs.md)** - Terraform setup
- **[Overall Architecture](docs/handover-docs/overall-architecture.md)** - System design

## 🔧 Environment Variables

### On-Premise Setup
```bash
# Database
DB_HOST=localhost              # or your database server IP
DB_PORT=5432
DB_NAME=converge_db
DB_USER=converge_user
DB_PASSWORD=your-password

# AI
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Application
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-frontend-domain.com
SESSION_SECRET=your-random-secret
```

See `env.onpremise.example` for complete configuration.

### AWS Deployment
See `env.aws.example` for AWS-specific configuration.

## 🚢 Deployment

### AWS Staging (via GitHub Actions)

Push to `dev` branch triggers automatic deployment:

```bash
git push origin dev
```

### Manual Deployment

```bash
# Build and push to ECR
npm run build
docker build -t converge-be .
# Follow AWS deployment steps in docs/CICD_SETUP.md
```

## 🧪 Testing

```bash
npm test                    # All tests
npm test -- hierarchy       # Specific test suite
npm run test:coverage       # Coverage report
```

## 📞 Support

- **Documentation**: See `docs/handover-docs/`
- **API Docs**: http://localhost:3000/api/docs (dev)
- **Issues**: Contact backend team

---

**License**: Proprietary
