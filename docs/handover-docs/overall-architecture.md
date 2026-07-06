# Overall Architecture

**Purpose:** Complete system architecture overview for handover documentation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Key Design Decisions](#key-design-decisions)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

Converge Global Backend is a Node.js/TypeScript e-commerce chatbot system that provides:

- **AI-Powered Chatbot**: Real-time conversation with Google Gemini AI for product recommendations
- **Product Management**: RESTful API for telecommunications products
- **WebSocket Communication**: Real-time chat via Socket.IO
- **Database Integration**: PostgreSQL with Drizzle ORM
- **Cloud Deployment**: AWS ECS with RDS and ALB

### Core Functionality

1. **Chat System**: AI-driven conversations that help users find products
2. **Product Search**: Full-text search across solutions, categories, and products
3. **Shopping Cart**: Session-based cart management
4. **Session Management**: Automatic session expiration and cleanup
5. **Real-time Updates**: WebSocket support for live chat responses

---

## Architecture Diagram

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
│  ┌──────────────────────────────────────┐                  │
│  │ ChatService                            │                  │
│  │ - Conversation orchestration            │                  │
│  │ - Session management                    │                  │
│  └──────────────────────────────────────┘                  │
│  ┌──────────────────────────────────────┐                  │
│  │ LangChainService                      │                  │
│  │ - AI model integration (Gemini)       │                  │
│  │ - Streaming responses                 │                  │
│  │ - Prompt engineering                  │                  │
│  └──────────────────────────────────────┘                  │
│  ┌──────────────────────────────────────┐                  │
│  │ ItemSearchService                     │                  │
│  │ - Full-text search                    │                  │
│  │ - Entity extraction                   │                  │
│  │ - Product retrieval                   │                  │
│  └──────────────────────────────────────┘                  │
│  ┌──────────────────────────────────────┐                  │
│  │ ItemService                           │                  │
│  │ - CRUD operations                      │                  │
│  │ - Item hierarchy management           │                  │
│  └──────────────────────────────────────┘                  │
│  ┌──────────────────────────────────────┐                  │
│  │ CartService                           │                  │
│  │ - Cart management                     │                  │
│  │ - User selections                     │                  │
│  └──────────────────────────────────────┘                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Database (PostgreSQL 16.8)                     │
│  - Items (solutions, categories, products)                   │
│  - Chat sessions & conversations                             │
│  - Cart data                                                 │
│  - Target audiences                                          │
│  - User selections                                           │
│  - Sales leads                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend

| Component     | Technology      | Version/Purpose         |
| ------------- | --------------- | ----------------------- |
| Runtime       | Node.js         | 20+                     |
| Language      | TypeScript      | Latest                  |
| Framework     | Express.js      | Web server              |
| Real-time     | Socket.IO       | WebSocket communication |
| ORM           | Drizzle ORM     | Database abstraction    |
| Database      | PostgreSQL      | 16.8                    |
| AI/NLP        | LangChain       | AI orchestration        |
| AI Model      | Google Gemini   | 2.0 Flash               |
| Validation    | class-validator | Request validation      |
| Testing       | Vitest          | Unit/integration tests  |
| Documentation | Swagger/OpenAPI | API docs                |

### Infrastructure

| Component              | Technology      | Purpose                 |
| ---------------------- | --------------- | ----------------------- |
| Container              | Docker          | Application packaging   |
| Orchestration          | AWS ECS Fargate | Serverless containers   |
| Database               | AWS RDS         | Managed PostgreSQL      |
| Load Balancer          | AWS ALB         | HTTP/WebSocket routing  |
| Infrastructure as Code | Terraform       | AWS resource management |
| Container Registry     | AWS ECR         | Docker image storage    |
| CI/CD                  | GitHub Actions  | Automated deployment    |

### Frontend Integration

| Component        | Technology       | Purpose         |
| ---------------- | ---------------- | --------------- |
| Framework        | Next.js          | React framework |
| Language         | TypeScript       | Type safety     |
| WebSocket Client | Socket.IO Client | Real-time chat  |

---

## Component Architecture

### Controllers

**Location:** `src/controllers/`

- **ChatController**: Handles chat-related REST endpoints
- **ItemController**: Manages product/item CRUD operations
- **CartController**: Handles shopping cart operations

### Services

**Location:** `src/services/`

#### ChatService

- Orchestrates conversation flow
- Manages session lifecycle
- Coordinates with LangChainService and ItemSearchService
- Handles chat history retrieval

#### LangChainService

- Integrates with Google Gemini via LangChain
- Manages streaming responses
- Handles prompt engineering
- Executes AI model calls

#### ItemSearchService

- Full-text search using PostgreSQL FTS
- Entity extraction from user queries
- Product recommendation logic
- Search result ranking

#### ItemService

- CRUD operations for items
- Item hierarchy management (Solution → Category → Product)
- Item type validation

#### CartService

- Shopping cart management
- User selection tracking
- Sales lead creation

### Models

**Location:** `src/models/`

- Database schema definitions using Drizzle ORM
- Type-safe database models
- Relationships and constraints

### Middleware

**Location:** `src/middleware/`

- **Error Handling**: Centralized error responses
- **Logging**: Request/response logging
- **Validation**: Input validation
- **Rate Limiting**: API throttling

### WebSockets

**Location:** `src/websockets/`

- Socket.IO event handlers
- Real-time chat message processing
- Connection management

---

## Data Flow

### Chat Flow

1. **User sends message** (via WebSocket or REST)
2. **ChatController** receives request
3. **ChatService** orchestrates:
   - Retrieves chat history from database
   - Extracts entities via ItemSearchService
   - Searches products via ItemSearchService
   - Builds context for AI
4. **LangChainService** calls Gemini AI with context
5. **Streaming response** sent to client via WebSocket
6. **Conversation saved** to database

### Product Search Flow

1. **User query received** (REST or via chat)
2. **ItemSearchService** processes:
   - Entity extraction (keywords, item types)
   - Full-text search via PostgreSQL FTS
   - Result ranking and filtering
3. **Results returned** to client
4. **Context stored** for AI recommendations

### Cart Management Flow

1. **User adds item to cart** (REST API)
2. **CartService** validates item
3. **Cart data stored** in database (user_selections table)
4. **Cart retrieved** on subsequent requests
5. **Sales lead created** when user completes selection

---

## Key Design Decisions

### 1. Unified Item Model

**Decision**: Single `items` table with hierarchical structure (Solution → Category → Product)

**Rationale**:

- Simpler queries
- Better performance with FTS
- Easier to maintain
- Supports flexible product structure

**See:** [UNIFIED_ITEM_MODEL.md](../UNIFIED_ITEM_MODEL.md)

### 2. PostgreSQL Full-Text Search

**Decision**: Use PostgreSQL FTS instead of external search engine

**Rationale**:

- No additional infrastructure needed
- Excellent performance (3-5x faster)
- Better integration with existing queries
- Reduced complexity

**See:** [SEARCH_FIX_SUMMARY.md](../SEARCH_FIX_SUMMARY.md)

### 3. Service Layer Pattern

**Decision**: All business logic in services, controllers are thin

**Rationale**:

- Better testability
- Reusable logic
- Clear separation of concerns
- Easier to maintain

### 4. Streaming Responses

**Decision**: Use WebSocket streaming for AI responses

**Rationale**:

- Better user experience (faster perceived response)
- More responsive UI
- Efficient resource usage
- Real-time feedback

**See:** [langchain-docs/](../langchain-docs/)

### 5. Session Management

**Decision**: Automatic session expiration and cleanup

**Rationale**:

- Security (prevents data accumulation)
- Performance (cleaner database)
- Compliance (data retention policies)
- Automated maintenance

**See:** [MIGRATION_EXECUTION_SUMMARY.md](../MIGRATION_EXECUTION_SUMMARY.md)

---

## Deployment Architecture

### Deployment Options

The Converge Backend can be deployed in multiple ways:

1. **On-Premise** (Self-hosted PostgreSQL + Node.js server)
2. **AWS** (ECS + RDS)
3. **Kubernetes** (Any cloud or on-premise)

### Option 1: On-Premise Architecture (Recommended for Client Handover)

```
Internet
    │
    ▼
┌─────────────────────┐
│   Frontend Server   │ Already deployed (Next.js)
│   (Client's infra)  │
└──────────┬──────────┘
           │ HTTP/REST + WebSocket
           │
           ▼
┌─────────────────────┐
│   Backend Server    │ Node.js + Express
│   (On-Premise)      │ - REST API
│   - Port 3000       │ - Socket.IO WebSocket
│   - PM2/Systemd     │ - AI Chatbot Service
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│PostgreSQL Database  │ On-Premise PostgreSQL 16.8+
│  (On-Premise)       │ - Product catalog
│  - Port 5432        │ - Chat sessions
│  - Local/Network    │ - User data
└─────────────────────┘
```

**See:** [On-Premise Database Setup Guide](./on-premise-database-setup.md)

### Option 2: AWS Infrastructure

```
Internet
    │
    ▼
┌─────────────────┐
│  CloudFront CDN │ (Optional - not yet configured)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   ALB (HTTPS)   │ Application Load Balancer
│  - HTTP/HTTPS   │ - WebSocket support
│  - WebSocket    │ - Health checks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ECS Fargate    │ Backend Containers
│  - Auto-scaling │ - Task definitions
│  - Logging      │ - Environment variables
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   RDS (Postgres)│ Managed Database
│  - db.t4g.micro │ - Automated backups
│  - Multi-AZ     │ - Security groups
└─────────────────┘
```

**See:** [AWS & Terraform Documentation](./aws-terraform-docs.md)

### Networking

- **VPC**: Isolated network environment
- **Public Subnets**: ALB and NAT Gateway
- **Private Subnets**: ECS tasks and RDS
- **Security Groups**: Controlled network access
- **NAT Gateway**: Outbound internet for ECS tasks

### Security

- **SSL/TLS**: HTTPS via ALB and ACM certificates
- **Security Groups**: Network-level firewall rules
- **Secrets Management**: AWS Secrets Manager for sensitive data
- **Database**: Private subnet, no direct internet access
- **IAM Roles**: Least privilege access for services

### Scalability

- **ECS Auto-scaling**: Based on CPU/memory metrics
- **ALB**: Distributes traffic across tasks
- **Database**: Can scale vertically (instance class)
- **CDN**: CloudFront ready for future implementation

**See:** [aws-deployment-guide.md](../aws-deployment-guide.md) for detailed deployment instructions

---

## Next Steps

For detailed information on specific areas:

- **CI/CD**: [cicd-docs.md](./cicd-docs.md)
- **AWS/Terraform**: [aws-terraform-docs.md](./aws-terraform-docs.md)
- **Database**: [db-docs.md](./db-docs.md)
- **LangChain**: [langchain-docs.md](./langchain-docs.md)

---

**Document Maintained By:** Development Team  
**Review Frequency:** Quarterly or upon major architecture changes
