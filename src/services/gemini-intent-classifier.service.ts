// src/services/gemini-intent-classifier.service.ts

/**
 * GeminiIntentClassifier: Fast and accurate intent classification using Gemini Flash 2.0
 *
 * Replaces brittle regex patterns with AI-powered classification.
 *
 * Classifies user messages into:
 * - greeting: "Hi", "Hello", "Hey there"
 * - product_query: Questions about products/solutions
 * - clarification: Follow-up questions requesting more details
 * - comparison: "What's the difference between X and Y?"
 * - other: Off-topic or unclear messages
 *
 * Also extracts normalized messages (typos fixed, standardized) and key context.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Logger } from "../utils/logger.js";

/**
 * Intent classification result from Gemini
 */
export interface IntentClassification {
  /** Primary intent */
  intent:
    | "greeting"
    | "product_query"
    | "clarification"
    | "clarification_request"
    | "comparison"
    | "off_topic"
    | "other";

  /** Confidence score (0-1) */
  confidence: number;

  /** Normalized/cleaned message (typos fixed, standardized) */
  normalizedMessage: string;

  /** Extracted business context */
  extractedContext: {
    /** Solution category if detected */
    solution?:
      | "Internet"
      | "Security Anti-DDos"
      | "Transport"
      | "Satellite"
      | "Content"
      | "Managed Services";

    /** Specific category if detected */
    category?: string;

    /** User's business need/scenario */
    userNeed?: string;

    /** Industry if mentioned */
    industry?:
      | "Hospitality"
      | "Healthcare"
      | "Education"
      | "Enterprise"
      | "SME";
  };

  /** Reasoning for classification (for debugging) */
  reasoning?: string;
}

/**
 * Gemini-powered Intent Classifier
 *
 * Uses Gemini Flash 2.0 for fast, accurate intent classification.
 * This replaces brittle regex patterns with semantic understanding.
 *
 * Benefits:
 * - Handles variations ("hi?", "hello!", "hey there")
 * - Understands context ("security recommendations?", "need ddos protection")
 * - Fast (<500ms) and cost-effective
 * - Graceful degradation (falls back to regex on failure)
 */
export class GeminiIntentClassifierService {
  private model: ChatGoogleGenerativeAI;
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ serviceName: "GeminiIntentClassifier" });

    // Use Gemini 2.5 Flash for fast, cost-effective classification
    this.model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.1, // Low temperature for consistent classification
      maxOutputTokens: 200, // Small output for fast response
      apiKey: process.env.GOOGLE_GEMINI_API_KEY, // Use same API key as LangChainService
    });

    this.logger.info("GeminiIntentClassifierService initialized");
  }

  /**
   * Basic text cleanup (whitespace, punctuation)
   * Gemini handles typo correction semantically as part of classification
   *
   * @private
   */
  private cleanMessage(message: string): string {
    let cleaned = message.trim();

    // Remove excessive punctuation (multiple ?! → single ?)
    cleaned = cleaned.replace(/([?!])+/g, "$1");

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  /**
   * Classify user's intent using Gemini
   * Gemini semantically understands typos and returns normalized text
   *
   * @param message - User's message
   * @param conversationHistory - Optional conversation context
   * @returns Intent classification with confidence, normalized message, and extracted context
   */
  async classifyIntent(
    message: string,
    conversationHistory?: string
  ): Promise<IntentClassification> {
    const startTime = Date.now();

    // 🔥 STEP 1: Basic cleanup (whitespace, punctuation)
    const cleanedMessage = this.cleanMessage(message);

    // 🔥 FAST PATH: Check greeting via regex before calling Gemini (saves ~5-10s)
    const lower = cleanedMessage.toLowerCase();
    if (
      /^(hi|hello|hey|good morning|good afternoon|good evening|greetings|howdy)\b/i.test(
        lower
      )
    ) {
      const duration = Date.now() - startTime;
      this.logger.info("Intent classified (fast path)", {
        originalMessage: message,
        intent: "greeting",
        duration,
      });
      return {
        intent: "greeting",
        confidence: 0.95,
        normalizedMessage: cleanedMessage,
        extractedContext: {},
        reasoning: "Fast path: greeting pattern detected without Gemini",
      };
    }

    // 🔥 FAST PATH: "Help me choose" quick-action button.
    // Handles both the canonical form and the legacy "I'm interested in …" wrapper
    // that the floating widget used to send before the frontend fix landed.
    // Trailing punctuation tolerated.
    if (/^(i'?m interested in\s+)?help me choose[\s.!?]*$/i.test(lower)) {
      this.logger.info("Intent classified (fast path)", {
        originalMessage: message,
        intent: "clarification_request",
      });
      return {
        intent: "clarification_request",
        confidence: 0.95,
        normalizedMessage: "Help me choose",
        extractedContext: {},
        reasoning:
          "Fast path: 'help me choose' quick-action triggers clarification flow",
      };
    }

    try {
      // 🔥 STEP 2: Gemini handles typo correction + intent classification
      const prompt = this.buildClassificationPrompt(
        cleanedMessage,
        conversationHistory
      );

      this.logger.debug("Classifying intent", {
        message: cleanedMessage,
        historyProvided: !!conversationHistory,
      });

      const response = await this.model.invoke(prompt);
      const responseText = response.content.toString();

      // Parse JSON response (includes Gemini's normalized message)
      const classification = this.parseClassificationResponse(responseText);

      const duration = Date.now() - startTime;

      this.logger.info("Intent classified", {
        originalMessage: message,
        normalizedMessage: classification.normalizedMessage,
        intent: classification.intent,
        confidence: classification.confidence,
        solution: classification.extractedContext.solution,
        duration,
      });

      return classification;
    } catch (error) {
      this.logger.error("Intent classification failed", error as Error, {
        message,
      });

      // Fallback to simple pattern matching
      return this.fallbackClassification(cleanedMessage);
    }
  }

  /**
   * Build prompt for intent classification
   * @private
   */
  private buildClassificationPrompt(
    message: string,
    conversationHistory?: string
  ): string {
    const historyContext = conversationHistory
      ? `\n\nCONVERSATION HISTORY:\n${conversationHistory}\n`
      : "";

    return `You are an intent classifier for an ICT products chatbot. Classify the user's intent and extract relevant context.

AVAILABLE SOLUTIONS:
- Internet (Fiber Broadband, Fiber Dedicated)
- Security Anti-DDos (DDoS protection, cybersecurity)
- Transport (VPN, SD-WAN, MPLS)
- Satellite (Starlink)
- Content (IPTV, Live TV)
- Managed Services (Wi-Fi, surveillance)
${historyContext}
USER MESSAGE: "${message}"

TASK: Classify intent, extract context, and normalize the message (fix typos, standardize terminology).

INTENT TYPES:
1. "greeting" - User is ONLY greeting (MUST be standalone: "hi", "hello", "hey", "good morning")
2. "product_query" - User wants product recommendations (asking about products, solutions, needs)
3. "clarification" - User asking for more info about previous recommendation
4. "comparison" - User comparing products or asking "what else"
5. "off_topic" - User asking something unrelated to ICT/telecom products (math, weather, jokes, general knowledge, personal questions, etc.)
6. "other" - Cannot determine intent

⚠️ CRITICAL GREETING RULES:
- ✅ "hi" → greeting (standalone)
- ✅ "hello" → greeting (standalone)
- ✅ "hey there" → greeting (standalone)
- ❌ "hi, I need internet" → product_query (NOT a greeting! User has a need)
- ❌ "hello, im a startup" → product_query (NOT a greeting! User is describing their situation)
- ❌ "im looking for..." → product_query (NOT a greeting!)
- **RULE**: If message contains ANY business need, industry mention, product keyword, or question → product_query

⚠️ SELF-DECLARATION RULE:
Users may explicitly declare their intent without a concrete question. Treat these as the declared intent with high confidence (0.9+):
- "I have a product query" / "I want to ask about products" / "Help me find a product" → product_query
- "I'd like a clarification" / "I need to clarify something" / "Can you clarify?" → clarification
- "I want to compare options" / "Help me compare" / "I'd like a comparison" → comparison

FEW-SHOT EXAMPLES:

product_query:
- "I need internet for my office" → product_query (concrete need)
- "What security services do you have?" → product_query (catalog question)
- "I have a product query" → product_query (self-declaration, confidence 0.9)

clarification:
- "Tell me more about that" → clarification (follow-up on previous)
- "What speeds does it support?" → clarification (deeper detail)
- "I'd like a clarification" → clarification (self-declaration, confidence 0.9)

comparison:
- "What's the difference between X and Y?" → comparison (explicit diff)
- "What else do you have?" → comparison (alternatives request)
- "I want to compare options" → comparison (self-declaration, confidence 0.9)

OUTPUT (JSON only, no markdown):
{
  "intent": "product_query",
  "confidence": 0.95,
  "normalizedMessage": "I'm a startup looking for connection in remote areas of Philippines",
  "extractedContext": {
    "solution": "Satellite",
    "category": null,
    "userNeed": "remote area connectivity",
    "industry": "Startup"
  },
  "reasoning": "User mentioned startup and remote area connectivity, indicating product need"
}

NORMALIZATION RULES:
- Fix typos: "satelite" → "satellite", "solujtions" → "solutions", "recomendations" → "recommendations", "phillipines" → "Philippines"
- Standardize: "cybersecurity" / "cyber security" → "cybersecurity", "im" → "I'm", "wifi" → "Wi-Fi"
- Keep natural: Don't over-correct casual language
- Preserve meaning: "hi?" → "hi", "security?" → "security solutions"

CONTEXT EXTRACTION RULES:
- Remote areas / rural / provinces → Satellite solution (Starlink)
- Security / DDoS / cyber → "Security Anti-DDos"
- Internet / broadband / fiber / connectivity (urban) → "Internet"
- Transport / VPN / SD-WAN / MPLS / WAN → "Transport"
- IPTV / TV / live TV / content → "Content"
- Wi-Fi / wireless / managed → "Managed Services"
- Hotel / resort / hospitality → industry: "Hospitality"
- Startup / SME / small business → industry: "SME"
- Confidence: 0.9+ for clear intents, 0.5-0.8 for ambiguous, <0.5 for unclear

Respond with ONLY the JSON object, no explanation.`;
  }

  /**
   * Parse Gemini's classification response
   * @private
   */
  private parseClassificationResponse(
    responseText: string
  ): IntentClassification {
    try {
      // Remove markdown code blocks if present
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        intent: parsed.intent || "other",
        confidence: parsed.confidence || 0.5,
        normalizedMessage: parsed.normalizedMessage || "", // 🔥 Gemini provides normalized text
        extractedContext: parsed.extractedContext || {},
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      this.logger.error(
        "Failed to parse classification response",
        error as Error,
        {
          responseText,
        }
      );

      return this.fallbackClassification("");
    }
  }

  /**
   * Fallback classification using simple pattern matching
   * @private
   */
  private fallbackClassification(message: string): IntentClassification {
    const lower = message.toLowerCase().trim();

    // Greeting patterns
    if (
      /^(hi|hello|hey|good morning|good afternoon|good evening|greetings|howdy)/i.test(
        lower
      )
    ) {
      return {
        intent: "greeting",
        confidence: 0.9,
        normalizedMessage: message, // Fallback: use original message
        extractedContext: {},
        reasoning: "Regex fallback: detected greeting pattern",
      };
    }

    // Security patterns
    if (
      /(security|cybersecurity|cyber\s|ddos|anti-?ddos|protection)/i.test(lower)
    ) {
      return {
        intent: "product_query",
        confidence: 0.7,
        normalizedMessage: message, // Fallback: use original message
        extractedContext: {
          solution: "Security Anti-DDos",
        },
        reasoning: "Regex fallback: detected security keywords",
      };
    }

    // Off-topic patterns (math, general knowledge, personal questions)
    if (
      /^(what('s| is) \d|how (old|tall|much is \d)|who (is|was) |where (is|was) |when (is|was|did) |calculate|solve|translate)/i.test(lower) ||
      /^(tell me a joke|what time|what day|what year|sing|write me a (poem|song|story))/i.test(lower)
    ) {
      return {
        intent: "off_topic",
        confidence: 0.9,
        normalizedMessage: message,
        extractedContext: {},
        reasoning: "Regex fallback: detected off-topic pattern",
      };
    }

    // Default to product query
    return {
      intent: "product_query",
      confidence: 0.5,
      normalizedMessage: message, // Fallback: use original message
      extractedContext: {},
      reasoning: "Regex fallback: default to product query",
    };
  }
}
