## Converge Global Backend (Agentic) — Handover

### TL;DR
- **Runtime**: Node.js + Express + Socket.IO + Drizzle (Postgres) + LangChain (Gemini).
- **Chat is WebSocket-first**: HTTP `POST /api/chat` returns **426** (Upgrade Required). Real-time chat uses Socket.IO event `chat_message`.
- **Agent loop (current “Catalog-in-Prompt” architecture)**:
  - Intent classification (Gemini) → session ensure → intelligent context selection → catalog cache (DB-backed) → Gemini (structured JSON) → stream reply + emit recommendations → persist turn.
- **Catalog data model**: Unified `item` table with a 3-level hierarchy **solution → category → product**.

---

### 1) Overview of the agentic backend system

This backend is a **real-time, agentic recommendation system** for Converge ICT solutions. It acts like an “AI consultant”:

- It keeps **conversation state** per `session_id` (`chat_sessions`, `chat_conversations`).
- It fetches and caches the **full catalog** from Postgres (`item` table) using `CatalogCacheService` (5-minute TTL).
- It uses **Gemini via LangChain** to:
  - classify intent + normalize user text (`GeminiIntentClassifierService`)
  - generate **structured recommendations** from the **full catalog** (`LangChainService.generateRecommendationsFromCatalog`)
- It emits a **streaming response** to the frontend via Socket.IO:
  - `start` → many `token` → `recommendations` → `end`

Key source files:
- **Entrypoint (dev)**: `src/app.ts` (`npm run dev`)
- **Entrypoint (prod build output)**: `dist/app.js` (`npm run start`)
- **Socket handler**: `src/websockets/chat.handler.ts`
- **Chat orchestration**: `src/services/chat.service.ts`
- **AI integration**: `src/services/langchain.service.ts`, `src/services/gemini-intent-classifier.service.ts`
- **Conversation context**: `src/services/context.service.ts`, `src/services/context-selector.service.ts`, `src/services/context-formatter.service.ts`
- **Catalog caching**: `src/services/catalog-cache.service.ts`
- **DB schema**: `src/models/schema.model.ts`

---

### 2) System architecture walkthrough (with Mermaid diagrams)

#### 2.1 High-level architecture (clients + backend + dependencies)

```mermaid
flowchart LR
  %% Color palette
  classDef client fill:#E8F5E9,stroke:#2E7D32,color:#1B5E20
  classDef edge fill:#E3F2FD,stroke:#1565C0,color:#0D47A1
  classDef db fill:#FFF3E0,stroke:#EF6C00,color:#E65100
  classDef ai fill:#F3E5F5,stroke:#6A1B9A,color:#4A148C
  classDef infra fill:#FCE4EC,stroke:#AD1457,color:#880E4F

  FE[Frontend / Client\n(Web App / Mobile)]:::client

  subgraph BE[converge-global-be]
    API[Express REST API\n/api/*]:::edge
    WS[Socket.IO Server\n(WebSocket + polling)]:::edge
    SVC[Services Layer\n(chat/item/cart/context)]:::edge
  end

  PG[(PostgreSQL\nDrizzle ORM)]:::db
  GEM[Google Gemini\n(via LangChain)]:::ai
  SECRETS[Secrets Manager\n(GCP optional)]:::infra
  CLOUDSQL[Cloud SQL Connector\n(GCP optional)]:::infra

  FE -->|HTTP| API
  FE <--> |Socket.IO events| WS

  API --> SVC
  WS --> SVC

  SVC -->|queries/transactions| PG
  SVC -->|prompt + structured output| GEM

  SVC -.->|if using GCP path| SECRETS
  SVC -.->|if using GCP path| CLOUDSQL
```

Notes:
- In dev, the server enables Swagger UI at `GET /api/docs` (see `src/app.ts`, `src/config/swagger.ts`).
- DB can be configured for **AWS/RDS** or **GCP Cloud SQL**:
  - AWS-style: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - GCP Cloud SQL: `INSTANCE_CONNECTION_NAME` (optionally uses Secret Manager for creds)

---

#### 2.2 WebSocket agentic chat flow (end-to-end)

```mermaid
flowchart TD
  classDef ws fill:#E3F2FD,stroke:#1565C0,color:#0D47A1
  classDef svc fill:#E8F5E9,stroke:#2E7D32,color:#1B5E20
  classDef ai fill:#F3E5F5,stroke:#6A1B9A,color:#4A148C
  classDef db fill:#FFF3E0,stroke:#EF6C00,color:#E65100
  classDef io fill:#FCE4EC,stroke:#AD1457,color:#880E4F

  FE[Client]:::io
  WS[Socket.IO\nchat_message handler]:::ws
  DTO[DTO validation\n(ChatRequestDto)]:::svc
  INTENT[Intent + normalization\n(GeminiIntentClassifierService)]:::ai
  SESSION[Session ensure\n(SessionManagementService)]:::svc
  CTX[Load context\n(ContextService.loadIntelligentContext)]:::svc
  SELECT[Stage detection + turn selection\n(ContextSelector)]:::ai
  CATALOG[CatalogCacheService\n(getCatalog, TTL=5m)]:::svc
  PG[(Postgres)]:::db
  LC[Generate structured recommendation\n(LangChainService)]:::ai
  STREAM[Emit: start → token* → recommendations → end]:::ws
  SAVE[Persist turn\n(ContextService.saveTurn)]:::svc

  FE -->|emit chat_message| WS
  WS --> DTO
  DTO --> INTENT
  INTENT --> SESSION
  SESSION --> CTX
  CTX --> SELECT
  CTX --> CATALOG
  CATALOG -->|cache miss| PG
  CATALOG --> LC
  CTX --> LC
  LC --> STREAM
  STREAM --> FE
  LC --> SAVE
  SAVE --> PG
```

Where this is implemented:
- Socket handler: `src/websockets/chat.handler.ts`
- Orchestration: `src/services/chat.service.ts` (`processMessageStream`)

Front-end event contract (Socket.IO):
- **Inbound**: `chat_message` payload is the shape of `ChatRequestDto`:
  - `{ "session_id": "…", "message": "…" }`
- **Outbound**:
  - `start`: `{ sessionId }` (used by UI to clear prior stream)
  - `token`: `{ payload: string, isComplete: boolean }` (streaming chunks)
  - `recommendations`: `{ payload: ItemDto[] }`
  - `end`: no payload
  - `error`: `{ type: "validation_error" | "database_error" | "ai_error" | "general_error", payload: string }`

---

#### 2.3 Catalog + chat persistence model (conceptual)

```mermaid
flowchart LR
  classDef db fill:#FFF3E0,stroke:#EF6C00,color:#E65100
  classDef entity fill:#E8F5E9,stroke:#2E7D32,color:#1B5E20
  classDef note fill:#ECEFF1,stroke:#455A64,color:#263238

  ITEM[(item)]:::db
  TA[(target_audience)]:::db
  CHATSESS[(chat_sessions)]:::db
  CHATCONV[(chat_conversations)]:::db

  SOL[solution]:::entity
  CAT[category]:::entity
  PROD[product]:::entity
  NOTE1["Hierarchy:\nsolution → category → product\nvia item.parent_item_id"]:::note

  SOL -->|parent_item_id| CAT
  CAT -->|parent_item_id| PROD

  ITEM --- NOTE1
  ITEM -->|target_audience_id| TA

  CHATSESS -->|session_id| CHATCONV
  CHATCONV -.->|recommended_products: jsonb[] of item ids| ITEM
```

Implementation references:
- Schema: `src/models/schema.model.ts`
- Catalog cache + hierarchy build: `src/services/catalog-cache.service.ts`
- Conversation storage: `src/services/context.service.ts` (`saveTurn`, `loadContext`)

---

### 3) How the application is developed (DTO → Model → Service → Controller → Routes)

This project follows a typical layered backend structure:

#### 3.1 DTO layer (`src/dtos/`)
- Uses `class-validator` + `class-transformer`.
- Responsibilities:
  - validate inbound HTTP bodies / query params
  - provide typed shapes for responses
- Examples:
  - `ChatRequestDto`, `ChatResponseDto` in `src/dtos/chat.dto.ts`
  - `ItemDto`, `ItemQueryDto` in `src/dtos/item.dto.ts`
  - `AddToCartDto`, `CreateSalesLeadDto` in `src/dtos/cart.dto.ts`

#### 3.2 Model layer (`src/models/`)
- Uses **Drizzle schema** for Postgres tables, relations, and inferred TS types.
- Main schema file: `src/models/schema.model.ts`
- Key tables:
  - `item` (unified catalog: solution/category/product)
  - `chat_sessions`, `chat_conversations`
  - `user_selection`, `sales_lead`, `sales_lead_user_selection`

#### 3.3 Service layer (`src/services/`)
Services encapsulate business logic and dependency integrations:

- **Agentic chat services**
  - `ChatService`: orchestrator for WebSocket chat + streaming + persistence
  - `LangChainService`: Gemini integration + structured output contract
  - `GeminiIntentClassifierService`: intent + normalization pass
  - `ContextService`: DB operations for turns + session updates
  - `ContextSelector`: relevance scoring + turn selection + stage detection
  - `ContextFormatter`: stage-based formatting to prevent response accumulation
  - `CatalogCacheService`: caches catalog (flat + hierarchical) to reduce DB load

- **Standard CRUD-like services**
  - `ItemService`: fetch items + hierarchy + audiences
  - `CartService`: session cart behavior + “convert to sales lead”

#### 3.4 Controller layer (`src/controllers/`)
Controllers:
- parse/validate input DTOs
- call services
- map results to HTTP responses

Examples:
- `ItemController` calls `ItemService` (`src/controllers/item.controller.ts`)
- `CartController` calls `CartService` (`src/controllers/cart.controller.ts`)
- `ChatController` exposes chat history endpoint (`src/controllers/chat.controller.ts`)

#### 3.5 Routes layer (`src/routes/`)
Routes mount controllers under `/api`:
- `src/routes/index.ts` mounts:
  - `/api/chat`
  - `/api/items`
  - `/api/cart`

Notes:
- `/api/chat` is intentionally **426** to enforce WebSockets (see `src/routes/chat.routes.ts`).

---

### 4) How to run it (dev vs prod)

#### 4.1 Local development
- `npm run dev` runs `tsx src/app.ts`
- Swagger UI: `GET /api/docs`
- API base: `http://localhost:3000/api`
- Socket.IO: `ws://localhost:3000` (Socket.IO, not raw WS)

#### 4.2 Production
- `npm run build` → `tsc` (outputs `dist/*`)
- `npm run start` runs `node dist/app.js`

---

### 5) Critical configuration (env vars)

AI:
- `GOOGLE_GEMINI_API_KEY`: required for Gemini (intent classifier + recommendations)

HTTP/WS:
- `PORT` (default `3000`)
- `CORS_ORIGIN` (Socket.IO config uses this in `src/index.ts`; `src/app.ts` currently uses `"*"` in Socket.IO config)
- `LOG_LEVEL` (used by logger initialization in `src/index.ts`)

Database (AWS / RDS style):
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Optional: `DB_SSL=false` to disable SSL in `src/config/database.ts` (otherwise default SSL on)

Database (GCP Cloud SQL style):
- `INSTANCE_CONNECTION_NAME` (uses Cloud SQL connector)
- Credentials:
  - From Secret Manager (preferred) via `src/config/secrets.ts` (if configured), else `DB_USER`, `DB_PASSWORD`

Context selection tuning:
- `CONTEXT_RELEVANCE_THRESHOLD` (default 6.0)
- `CONTEXT_MAX_TURNS` (default 15)
- `CONTEXT_TOKEN_BUDGET_TOTAL` / `CONTEXT_TOKEN_BUDGET_SYSTEM` / `CONTEXT_TOKEN_BUDGET_AVAILABLE`
- `CONTEXT_SUMMARIZATION_THRESHOLD`
- `GEMINI_SCORING_MODEL` / `GEMINI_SCORING_TEMPERATURE`

---

### 6) Key extension points (where you’ll likely change things)

#### 6.1 Prompting + “behavior tuning”
- `src/services/langchain.service.ts`
  - `buildCatalogPrompt(...)`: system prompt content, output JSON contract, stage-specific rules.
  - Few-shot examples are loaded from `src/prompts/few-shot-examples/<version>/<stage>/*.json` via `FewShotExampleService`.

#### 6.2 Conversation state correctness (avoid response accumulation)
This is the most sensitive part:
- `ContextSelector.determineConversationStage(...)`: stage detection **source of truth**
- `ContextFormatter.formatContextForState(...)`: controls what history Gemini sees (often **no previous assistant responses**)

If you see “Gemini repeating itself” issues, start here.

#### 6.3 Catalog refresh / performance
- `CatalogCacheService` caches for 5 minutes.
- If you add admin endpoints later, a good first feature is:
  - an authenticated `POST /api/admin/catalog/refresh` that calls `CatalogCacheService.refreshCache()`.

---

### 7) Next few integrations / roadmap

#### 7.1 “Tools as wrapped services” (agent tool-calling)
Goal: move from “single-shot catalog prompting” to **actionable tool calls** with typed contracts.

Recommended approach:
- Introduce a **Tool Registry** (new module, e.g. `src/services/tools/`):
  - Each tool is a service implementing a typed interface, e.g.:
    - `SearchCatalogTool` (wraps `CatalogCacheService` + filtering)
    - `GetItemDetailsTool` (wraps `ItemService.getItemById`)
    - `AddToCartTool` (wraps `CartService.addToCart`)
    - `CreateLeadTool` (wraps `CartService.convertCartToSalesLead`)
- Add a single “tool execution” entrypoint in `ChatService`:
  - The model returns either:
    - a direct response, or
    - a tool call request (name + typed args)
  - Your backend executes the tool, then gives the result back to the model for final narration.

Why this helps:
- Easier to test deterministically (tools can be mocked).
- Safer than letting the model “hallucinate” actions.
- Lets you add integrations (Salesforce, pricing, availability checks) cleanly.

#### 7.2 LangSmith for agentic evaluation + observability
Goal: quickly answer “is the agent getting better?” and catch regressions.

Recommended scope:
- **Tracing**:
  - Enable LangChain tracing to LangSmith in `LangChainService` (and intent classifier if desired).
  - Standardize tags:
    - `conversationStage`, `solution`, `category`, `env`, `buildSha`
- **Datasets + evals**:
  - Create a small dataset from real user queries (sanitized).
  - Implement evaluations:
    - “No repetition” (recommendations shouldn’t repeat previous IDs)
    - “Valid JSON schema” (already enforced by Zod parser)
    - “Catalog grounding” (all IDs returned must exist in current catalog)
    - “Latency + token budget” (regression guardrails)

Where to hook it:
- `src/services/langchain.service.ts`: around `model.invoke(...)`
- `src/services/chat.service.ts`: log/trace stage, selected turn count, recommendation IDs.

---

### 8) Quick “where to look” debugging guide

- **“Chat endpoint is broken”**
  - Expected: `POST /api/chat` returns **426**. Use Socket.IO `chat_message`.
  - Check: `src/routes/chat.routes.ts`, `src/websockets/chat.handler.ts`

- **“It repeats the previous answer / accumulates responses”**
  - Check stage detection: `ContextSelector.determineConversationStage`
  - Check formatting rules: `ContextFormatter.formatForRecommendation` (should not include full assistant responses)
  - Check prompt rules: `LangChainService.buildCatalogPrompt`

- **“No recommendations / empty list”**
  - Check catalog cache: `CatalogCacheService.getCatalog` (DB connectivity, `item.is_active`)
  - Check structured parse logs in `LangChainService`

- **“DB errors”**
  - Connection pool: `src/config/database.ts` / `src/config/database.aws.ts`
  - Drizzle init: `src/db/index.ts` (`initializeDrizzle`)
  - Error wrapper: `src/utils/errorUtils.ts`, middleware `src/middleware/errorHandler.ts`

---

### 9) Suggested handover checklist (first week for the next owner)
- Read `src/services/chat.service.ts` end-to-end (it’s the “orchestrator”).
- Understand the 3 services that control correctness:
  - `ContextSelector` (stage) → `ContextFormatter` (history) → `LangChainService` (prompt + schema)
- Add one small, high-value improvement:
  - admin endpoint to refresh catalog cache, or
  - structured tool-calling skeleton (even with 1 tool).
- Add LangSmith tracing + one evaluation dataset.

