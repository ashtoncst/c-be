// src/services/topic-switch-detector.service.ts

/**
 * TopicSwitchDetectorService: Intelligent topic change detection using Gemini
 *
 * **Problem Solved:** Detects when user switches topics to prevent inappropriate
 * context carry-over and response accumulation.
 *
 * **Detection Types:**
 * - **CONTINUATION**: User asking more about same topic (e.g., "managed services" → "sd-wan")
 * - **SWITCH**: User changed to different topic (e.g., "internet" → "security")
 * - **CLARIFICATION**: User providing more context for same topic (e.g., "internet" → "for a hotel")
 *
 * **Features:**
 * - Gemini-powered classification (high accuracy)
 * - Fallback keyword-based detection (for offline/error scenarios)
 * - Confidence scoring
 * - Hierarchy-aware (understands SD-WAN is under Managed Services)
 *
 * **Usage:**
 * ```typescript
 * const detector = new TopicSwitchDetectorService();
 * const result = await detector.detectTopicSwitch(currentMessage, context);
 *
 * if (result.isSwitched && result.switchType === "switch") {
 *   // Clear previous recommendations
 *   context.currentRecommendations = [];
 * }
 * ```
 *
 * **References:**
 * - Research: docs/CONVERSATION_STATE_MANAGEMENT_RESEARCH.md
 * - Integration: src/services/chat.service.ts (after loading context)
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Logger } from "../utils/logger.js";
import type { ConversationContext } from "../dtos/chat.dto.js";

export interface TopicSwitchResult {
  isSwitched: boolean;
  previousTopic: string;
  currentTopic: string;
  switchType: "continuation" | "switch" | "clarification";
  confidence: number;
  reasoning: string;
}

export class TopicSwitchDetectorService {
  private model: ChatGoogleGenerativeAI;
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ serviceName: "TopicSwitchDetector" });
    this.model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.1, // Low temperature for consistent classification
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      maxOutputTokens: 512, // Small output for classification
    });
  }

  /**
   * Detect if user switched topics
   *
   * @param currentMessage - Current user message
   * @param context - Full conversation context
   * @returns Topic switch result with classification
   */
  async detectTopicSwitch(
    currentMessage: string,
    context: ConversationContext
  ): Promise<TopicSwitchResult> {
    // If no previous turns, this is initial query (not a switch)
    if (context.recentTurns.length === 0) {
      this.logger.debug("No previous turns, treating as initial query");
      return {
        isSwitched: false,
        previousTopic: "none",
        currentTopic: "initial",
        switchType: "continuation",
        confidence: 1.0,
        reasoning: "First message in conversation",
      };
    }

    const lastTurn = context.recentTurns[context.recentTurns.length - 1];

    this.logger.debug("Analyzing topic switch", {
      previousMessage: lastTurn.userMessage,
      currentMessage,
    });

    try {
      return await this.detectWithGemini(currentMessage, lastTurn.userMessage);
    } catch (error) {
      this.logger.error("Gemini topic detection failed, using fallback", error as Error);
      return this.fallbackDetection(currentMessage, lastTurn.userMessage);
    }
  }

  /**
   * Detect topic switch using Gemini (primary method)
   */
  private async detectWithGemini(
    currentMessage: string,
    previousMessage: string
  ): Promise<TopicSwitchResult> {
    const prompt = `You are a topic change detector for a telecom sales chatbot.

PREVIOUS USER MESSAGE: "${previousMessage}"
CURRENT USER MESSAGE: "${currentMessage}"

Determine if the user switched topics:

1. **CONTINUATION** - User asking more about SAME topic
   - Example: "managed services" → "sd-wan" (SD-WAN is under Managed Services)
   - Example: "internet" → "what speeds do you offer?" (clarifying internet details)
   - Example: "show me fiber" → "tell me about PEAK 200" (drilling into fiber options)

2. **SWITCH** - User changed to DIFFERENT unrelated topic
   - Example: "internet" → "security" (completely different solutions)
   - Example: "managed wifi" → "colocation" (different solution categories)
   - Example: "fiber broadband" → "satellite internet" (different connectivity types)

3. **CLARIFICATION** - User providing more context for SAME topic
   - Example: "I need internet" → "for a hotel with 50 rooms" (adding industry + scale)
   - Example: "show me managed services" → "we have 3 branches" (adding context)
   - Example: "what do you have?" → "we're a bank" (providing industry)

CONVERGE SOLUTIONS HIERARCHY (for context):
- **Internet**: Fiber Broadband, Fiber Dedicated, IX Express, IPT Express
- **Dedicated Internet Access**: DIA Premium, DIA Basic, DIA Bandwidth-on-Demand, DIA Clean Pipe, IPL+IP, IP Transport, Remote IX
- **Transport**: Metro Ethernet, IP VPN, SD-WAN, FASTER, Cloud Direct Connect
- **Satellite**: Starlink (for remote areas)
- **Content**: Content Plus, Apps, Live TV, E-Commerce, Hotel Information
- **Cable Systems**: BIFROST, SEA-H2X
- **Security Anti-DDos**: On-Premise Defense, Cloud Defenses, Hybrid Defenses
- **Managed Services**: Managed SD-WAN, Managed Intelligent Surveillance + IoT, Managed Wi-Fi Plus
- **Colocation**: Data Centers, Server Hosting
- **Cloud, AI & Cybersecurity**: Converge Managed Cloud, Converge App Studio, Converge SecOps Studio

IMPORTANT RULES:
- If current message drills down into previous topic (e.g., managed services → sd-wan), it's **CONTINUATION**
- If current message asks about unrelated solution (e.g., internet → security), it's **SWITCH**
- If current message adds details (industry, scale, location), it's **CLARIFICATION**
- "What else do you have?" or "show me other options" = **CONTINUATION** (exploring alternatives)
- "What about X instead?" = **SWITCH** (changing topic)

Respond in JSON format ONLY (no markdown, no explanation):
{
  "isSwitched": true/false,
  "previousTopic": "Managed Services",
  "currentTopic": "Security",
  "switchType": "continuation" | "switch" | "clarification",
  "confidence": 0.95,
  "reasoning": "Brief explanation"
}`;

    const response = await this.model.invoke(prompt);
    let responseText =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    // Clean up response (remove markdown code fences if present)
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "");
    }
    responseText = responseText.trim();

    // Parse JSON response
    const result = JSON.parse(responseText) as TopicSwitchResult;

    this.logger.info("Topic switch detection (Gemini)", {
      previousMessage,
      currentMessage,
      result,
    });

    return result;
  }

  /**
   * Fallback topic detection (simple keyword-based)
   * Used when Gemini fails or is unavailable
   */
  private fallbackDetection(
    currentMessage: string,
    previousMessage: string
  ): TopicSwitchResult {
    const currentLower = currentMessage.toLowerCase();
    const previousLower = previousMessage.toLowerCase();

    this.logger.debug("Using fallback topic detection");

    // Check for clarification patterns first
    const clarificationKeywords = [
      "for a",
      "for our",
      "with",
      "in the",
      "about",
      "around",
      "we are",
      "we have",
      "it's for",
      "i'm in",
    ];

    const hasClarification = clarificationKeywords.some((keyword) =>
      currentLower.includes(keyword)
    );

    if (hasClarification) {
      return {
        isSwitched: false,
        previousTopic: this.extractSimpleTopic(previousMessage),
        currentTopic: "Clarification",
        switchType: "clarification",
        confidence: 0.7,
        reasoning: "Clarification pattern detected (fallback)",
      };
    }

    // Simple heuristic: Check if key solution words changed
    const solutionKeywords = [
      "internet",
      "fiber",
      "broadband",
      "satellite",
      "starlink",
      "transport",
      "vpn",
      "wan",
      "security",
      "ddos",
      "cybersecurity",
      "managed",
      "wifi",
      "wi-fi",
      "content",
      "iptv",
      "tv",
      "colocation",
      "data center",
      "sd-wan",
      "sdwan",
    ];

    const previousKeywords = solutionKeywords.filter((kw) =>
      previousLower.includes(kw)
    );
    const currentKeywords = solutionKeywords.filter((kw) =>
      currentLower.includes(kw)
    );

    // Check for overlap
    const hasCommonKeywords = currentKeywords.some((kw) =>
      previousKeywords.includes(kw)
    );

    // Check for hierarchy relationship (e.g., "managed" → "sd-wan")
    const hierarchyRelationships = [
      { parent: "managed", children: ["sd-wan", "wifi", "wi-fi", "draas", "surveillance"] },
      { parent: "internet", children: ["fiber", "broadband", "connectivity"] },
      { parent: "transport", children: ["vpn", "wan", "sd-wan", "ethernet"] },
      { parent: "security", children: ["ddos", "cybersecurity", "anti-ddos"] },
    ];

    let isHierarchyMatch = false;
    for (const relationship of hierarchyRelationships) {
      const previousHasParent = previousLower.includes(relationship.parent);
      const currentHasChild = relationship.children.some((child) =>
        currentLower.includes(child)
      );
      const previousHasChild = relationship.children.some((child) =>
        previousLower.includes(child)
      );
      const currentHasParent = currentLower.includes(relationship.parent);

      if (
        (previousHasParent && currentHasChild) ||
        (previousHasChild && currentHasParent)
      ) {
        isHierarchyMatch = true;
        break;
      }
    }

    if (hasCommonKeywords || isHierarchyMatch) {
      return {
        isSwitched: false,
        previousTopic: this.extractSimpleTopic(previousMessage),
        currentTopic: this.extractSimpleTopic(currentMessage),
        switchType: "continuation",
        confidence: 0.6,
        reasoning: "Common keywords or hierarchy detected (fallback)",
      };
    } else if (currentKeywords.length > 0) {
      // Different keywords detected
      return {
        isSwitched: true,
        previousTopic: this.extractSimpleTopic(previousMessage),
        currentTopic: this.extractSimpleTopic(currentMessage),
        switchType: "switch",
        confidence: 0.6,
        reasoning: "Different topic keywords detected (fallback)",
      };
    } else {
      // No clear keywords, assume continuation
      return {
        isSwitched: false,
        previousTopic: this.extractSimpleTopic(previousMessage),
        currentTopic: "General",
        switchType: "continuation",
        confidence: 0.5,
        reasoning: "No clear topic keywords, assuming continuation (fallback)",
      };
    }
  }

  /**
   * Extract simple topic from message (keyword-based)
   */
  private extractSimpleTopic(message: string): string {
    const lower = message.toLowerCase();

    // Solutions
    if (lower.includes("internet") || lower.includes("fiber") || lower.includes("broadband"))
      return "Internet";
    if (lower.includes("satellite") || lower.includes("starlink")) return "Satellite";
    if (lower.includes("transport") || lower.includes("vpn") || lower.includes("wan"))
      return "Transport";
    if (lower.includes("security") || lower.includes("ddos") || lower.includes("cybersecurity"))
      return "Security";
    if (lower.includes("managed")) return "Managed Services";
    if (lower.includes("content") || lower.includes("iptv") || lower.includes("tv"))
      return "Content";
    if (lower.includes("colocation") || lower.includes("data center")) return "Colocation";

    // Categories
    if (lower.includes("sd-wan") || lower.includes("sdwan")) return "SD-WAN";
    if (lower.includes("wifi") || lower.includes("wi-fi")) return "Managed Wi-Fi";

    return "General";
  }
}

