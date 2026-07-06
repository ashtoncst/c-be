# LangChain Documentation

**Purpose:** Complete LangChain integration and AI model documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [LangChainService](#langchainservice)
5. [Streaming Responses](#streaming-responses)
6. [Vertex AI Integration](#vertex-ai-integration)
7. [Prompt Engineering](#prompt-engineering)
8. [Error Handling](#error-handling)
9. [Performance Optimization](#performance-optimization)

---

## Overview

The Converge Backend uses **LangChain** to integrate with **Google Gemini AI** for conversational AI capabilities. LangChain provides:

- **AI Model Integration**: Google Gemini 2.0 Flash
- **Streaming Responses**: Real-time token streaming via WebSocket
- **Prompt Engineering**: Structured prompts for consistent responses
- **Context Management**: Conversation history and product context
- **Error Handling**: Graceful fallbacks and retries

**Key Service:** `LangChainService` (`src/services/langchain.service.ts`)

---

## Architecture

### Integration Flow

```
ChatController/WebSocket
    │
    ▼
ChatService
    │
    ├─── Retrieves chat history
    ├─── Extracts entities (ItemSearchService)
    ├─── Searches products (ItemSearchService)
    │
    ▼
LangChainService
    │
    ├─── Builds prompt with context
    ├─── Calls Gemini AI model
    ├─── Streams response tokens
    │
    ▼
Socket.IO/WebSocket
    │
    ▼
Frontend (real-time display)
```

### Components

1. **LangChainService**: Main service for AI interactions
2. **ChatService**: Orchestrates conversation flow
3. **ItemSearchService**: Provides product context
4. **WebSocket Handler**: Streams responses to clients

---

## Setup & Configuration

### Prerequisites

1. **Google Cloud Platform Account**
2. **GCP Project** with Vertex AI API enabled
3. **API Key** or Service Account credentials
4. **LangChain Packages** installed

### Environment Variables

**Required:**

```bash
# Google Cloud Configuration
GCP_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=us-central1  # or your preferred region
GEMINI_API_KEY=your-api-key  # Alternative to service account
```

**Optional:**

```bash
# LangSmith Tracing (optional)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your-langsmith-api-key
```

### Installation

**Package:** `@langchain/google-vertexai`

```bash
npm install @langchain/google-vertexai @langchain/core
```

**Or for web environments:**

```bash
npm install @langchain/google-vertexai-web @langchain/core
```

### Authentication

**Option 1: API Key (Recommended for staging)**

```typescript
// Set GOOGLE_API_KEY environment variable
process.env.GEMINI_API_KEY = "your-api-key";
```

**Option 2: Service Account (Recommended for production)**

```bash
# Set service account credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Or use AWS Secrets Manager (production)
# Credentials stored in AWS Secrets Manager
```

---

## LangChainService

### Service Location

**File:** `src/services/langchain.service.ts`

### Key Methods

#### `initializeModel()`

Initializes the Gemini AI model.

```typescript
private async initializeModel(): Promise<ChatGoogleGenerativeAI> {
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxOutputTokens: 2048,
    // Additional configuration
  });
}
```

**Configuration:**

- **Model**: `gemini-2.0-flash` (fast, cost-effective)
- **Temperature**: `0.7` (balanced creativity/consistency)
- **Max Output Tokens**: `2048` (response length limit)

#### `generateResponse()`

Generates AI response with context.

```typescript
async generateResponse(
  userMessage: string,
  context: {
    chatHistory?: ChatMessage[];
    productContext?: string;
    userPreferences?: Record<string, unknown>;
  }
): Promise<string>
```

**Context Includes:**

- Chat history (conversation context)
- Product search results (relevant products)
- User preferences (stored preferences)

#### `streamResponse()`

Streams AI response token-by-token.

```typescript
async streamResponse(
  userMessage: string,
  context: ContextType
): AsyncGenerator<string, void, unknown>
```

**Usage:**

- Returns async generator
- Yields tokens as they're generated
- Used for real-time WebSocket responses

### Prompt Engineering

**System Prompt:**
Defines AI behavior and constraints.

**Components:**

1. **Role Definition**: AI is a product recommendation assistant
2. **Context Injection**: Product catalog and user preferences
3. **Response Format**: Structured JSON or natural language
4. **Constraints**: Prevent hallucinations, enforce product validation

**Example Prompt:**

```
You are a helpful telecommunications product recommendation assistant.
You help users find products based on their needs.

Available products:
{product_context}

User preferences:
{user_preferences}

Conversation history:
{chat_history}

User message: {user_message}

Provide a helpful response that recommends relevant products.
```

---

## Streaming Responses

### Implementation

**Reference:** [langchain-docs/langchain-streaming.md](../langchain-docs/langchain-streaming.md)

### Stream Method

**LangChain provides two streaming approaches:**

#### 1. `.stream()` - Final Output Streaming

Streams the final output in chunks:

```typescript
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
});

const stream = await model.stream("Hello! Tell me about yourself.");
for await (const chunk of stream) {
  console.log(chunk.content);
}
```

#### 2. `.streamEvents()` - Event-Based Streaming

Streams intermediate steps and final output:

```typescript
const eventStream = await model.streamEvents("hello", { version: "v2" });
for await (const event of eventStream) {
  if (event.event === "on_chat_model_stream") {
    console.log(event.data.chunk.content);
  }
}
```

### WebSocket Integration

**Usage in ChatService:**

```typescript
// Stream response to client via WebSocket
const stream = await this.langChainService.streamResponse(userMessage, context);

for await (const token of stream) {
  socket.emit("chat_response", {
    type: "token",
    content: token,
  });
}

socket.emit("chat_response", {
  type: "complete",
});
```

### HTTP Server-Sent Events (SSE)

**Alternative streaming via HTTP:**

```typescript
// Server-side handler
const handler = async () => {
  const eventStream = await chain.streamEvents(userMessage, {
    version: "v2",
    encoding: "text/event-stream",
  });
  return new Response(eventStream, {
    headers: {
      "content-type": "text/event-stream",
    },
  });
};
```

**Frontend (EventSource):**

```typescript
import { fetchEventSource } from "@microsoft/fetch-event-source";

await fetchEventSource("https://your-api-endpoint", {
  method: "POST",
  body: JSON.stringify({ message: "Hello" }),
  onmessage: (message) => {
    if (message.event === "data") {
      console.log(JSON.parse(message.data));
    }
  },
});
```

---

## Vertex AI Integration

### Setup

**Reference:** [langchain-docs/vertexai.md](../langchain-docs/vertexai.md)

### Using Vertex AI

**For production, use Vertex AI instead of API key:**

```typescript
import { ChatVertexAI } from "@langchain/google-vertexai";

const model = new ChatVertexAI({
  model: "gemini-1.0-pro",
  maxOutputTokens: 2048,
  project: process.env.GCP_PROJECT_ID,
  location: process.env.VERTEX_AI_LOCATION,
});
```

### Authentication

**Node.js Environment:**

- Use service account credentials
- Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Or authenticate via `gcloud auth application-default login`

**Web Environment:**

- Use `@langchain/google-vertexai-web` package
- Pass credentials directly in code (not recommended for sensitive apps)

### Model Options

**Available Models:**

- `gemini-1.0-pro`: Balanced performance
- `gemini-1.5-pro`: Enhanced capabilities
- `gemini-2.0-flash`: Fast and cost-effective (default)
- `gemini-pro-vision`: Image analysis support

---

## Prompt Engineering

### Best Practices

#### 1. Clear Instructions

- Define AI role clearly
- Specify output format
- Include examples when needed

#### 2. Context Injection

- Provide relevant product information
- Include conversation history
- Add user preferences

#### 3. Constraint Enforcement

- Prevent hallucinations (don't make up products)
- Validate product references
- Enforce response structure

#### 4. Error Prevention

- Use structured prompts
- Include fallback instructions
- Define error handling behavior

### Current Implementation

**See:** `src/services/langchain.service.ts` for current prompt structure

**Key Features:**

- Product context injection
- Chat history inclusion
- User preference awareness
- Hallucination prevention

**See:** [HALLUCINATION_FIX.md](../HALLUCINATION_FIX.md) for details

---

## Error Handling

### Retry Logic

**LangChain provides automatic retries:**

```typescript
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  maxRetries: 2, // Automatic retry on failure
  timeout: 30000, // 30 second timeout
});
```

### Error Types

1. **API Errors**: Network issues, rate limiting
2. **Model Errors**: Invalid prompts, token limits
3. **Timeout Errors**: Request takes too long

### Fallback Strategy

**Intelligent Fallback:**

```typescript
try {
  const response = await this.langChainService.generateResponse(
    userMessage,
    context
  );
  return response;
} catch (error) {
  // Fallback to predefined responses
  if (error instanceof RateLimitError) {
    return this.getFallbackResponse(userMessage);
  }
  throw error;
}
```

**See:** [intelligent-fallback-examples.md](../intelligent-fallback-examples.md)

---

## Performance Optimization

### Caching

**LangChain supports response caching:**

```typescript
import { InMemoryCache } from "@langchain/core/caches";

const cache = new InMemoryCache();
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  cache: cache, // Cache responses
});
```

### Batch Processing

**Process multiple requests efficiently:**

```typescript
const responses = await model.batch([
  "What is AI?",
  "How does machine learning work?",
  "Explain neural networks.",
]);
```

### Token Management

**Optimize token usage:**

1. **Truncate chat history**: Keep only recent messages
2. **Limit product context**: Top N relevant products
3. **Compress prompts**: Remove unnecessary text
4. **Monitor token usage**: Track costs

### Response Time Optimization

1. **Use faster models**: `gemini-2.0-flash` vs `gemini-1.5-pro`
2. **Stream responses**: Better perceived performance
3. **Cache common queries**: Reduce API calls
4. **Parallel processing**: Multiple requests concurrently

---

## Monitoring & Debugging

### LangSmith Tracing

**Enable LangSmith for tracing:**

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=your-api-key
```

**Benefits:**

- Track all AI calls
- Monitor performance
- Debug prompt issues
- Analyze costs

### Logging

**Log AI interactions:**

```typescript
logger.info("AI Request", {
  userMessage,
  context: sanitizedContext,
  model: "gemini-2.0-flash",
});

logger.info("AI Response", {
  response: sanitizedResponse,
  tokens: estimatedTokens,
});
```

### Metrics

**Track:**

- API call count
- Average response time
- Error rate
- Token usage
- Cost per request

---

## Testing

### Unit Tests

**Test LangChainService:**

```typescript
describe("LangChainService", () => {
  it("should generate response", async () => {
    const service = new LangChainService();
    const response = await service.generateResponse("Hello", {});
    expect(response).toBeDefined();
  });

  it("should stream response", async () => {
    const service = new LangChainService();
    const tokens: string[] = [];
    for await (const token of service.streamResponse("Hello", {})) {
      tokens.push(token);
    }
    expect(tokens.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

**Test full chat flow:**

```typescript
describe("Chat Integration", () => {
  it("should handle chat with AI", async () => {
    const response = await chatService.processMessage(
      "user-session",
      "What products do you have?"
    );
    expect(response).toContain("products");
  });
});
```

---

## Reference Documents

- [langchain-docs/langchain-streaming.md](../langchain-docs/langchain-streaming.md) - Streaming implementation
- [langchain-docs/vertexai.md](../langchain-docs/vertexai.md) - Vertex AI setup
- [HALLUCINATION_FIX.md](../HALLUCINATION_FIX.md) - Hallucination prevention
- [intelligent-fallback-examples.md](../intelligent-fallback-examples.md) - Fallback strategies
- [CHAT_RETRIEVAL_QUICK_REFERENCE.md](../CHAT_RETRIEVAL_QUICK_REFERENCE.md) - Chat implementation details

---

## Best Practices

1. **Always validate AI responses** before sending to users
2. **Use streaming** for better user experience
3. **Monitor token usage** to control costs
4. **Cache responses** for common queries
5. **Implement fallbacks** for error scenarios
6. **Log all AI interactions** for debugging
7. **Use structured prompts** for consistent responses
8. **Test with various inputs** to ensure robustness

---

## Troubleshooting

### Issue: API Key Not Working

**Error:** "Invalid API key"

**Solution:**

1. Verify API key is correct
2. Check API key has Vertex AI permissions
3. Ensure GCP project has Vertex AI API enabled
4. Try regenerating API key

### Issue: Streaming Not Working

**Error:** Response not streaming

**Solution:**

1. Verify WebSocket connection is active
2. Check `streamResponse` method is used
3. Ensure frontend handles streaming events
4. Check for network issues

### Issue: High Latency

**Error:** Slow AI responses

**Solution:**

1. Use faster model (`gemini-2.0-flash`)
2. Reduce context size
3. Enable streaming for better perceived performance
4. Check network latency to GCP
5. Consider using Vertex AI (better performance)

### Issue: Hallucinations

**Error:** AI making up products

**Solution:**

1. Improve prompt constraints
2. Validate responses against product database
3. Use structured output format
4. Add product validation step

**See:** [HALLUCINATION_FIX.md](../HALLUCINATION_FIX.md)

---

**Document Maintained By:** AI/ML Team
