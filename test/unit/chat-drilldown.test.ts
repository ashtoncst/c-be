// LangChainService eagerly creates a Gemini client at construction time, so
// ChatService instantiation will throw without an API key. Match the pattern
// used by other unit tests in this folder.
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? "test-key";
process.env.GOOGLE_GEMINI_API_KEY =
  process.env.GOOGLE_GEMINI_API_KEY ?? "test-key";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "../../src/services/chat.service.js";
import type { ItemSearchService } from "../../src/services/item-search.service.js";
import type { EnrichedItem } from "../../src/dtos/chat.dto.js";

/**
 * Drill-down product lookup (Fix 2 from UAT plan).
 *
 * UAT FAILs:
 *  - CC-04 "Tell me more about SD-WAN" → bot just regurgitated previous fiber
 *    products instead of looking up SD-WAN's actual description.
 *  - FB-005 "Tell me more about Fiber Broadband PEAK 50-100 mbps" → reply was
 *    just the product name repeated, no actual catalog description.
 *
 * Fix: detect drill-down phrasing, extract the candidate product name,
 * and use ItemSearchService.searchByNames() to fetch the real description.
 */
describe("ChatService drill-down lookup", () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
  });

  describe("detectDrillDownCandidate", () => {
    it('extracts the candidate from "Tell me more about SD-WAN"', () => {
      expect(service.detectDrillDownCandidate("Tell me more about SD-WAN")).toBe(
        "SD-WAN"
      );
    });

    it("extracts a multi-word product name preserving punctuation/spacing", () => {
      expect(
        service.detectDrillDownCandidate(
          "Tell me more about Fiber Broadband PEAK 50-100 mbps"
        )
      ).toBe("Fiber Broadband PEAK 50-100 mbps");
    });

    it('handles "more details about X" phrasing', () => {
      expect(
        service.detectDrillDownCandidate(
          "More details about Starlink Enterprise Kit"
        )
      ).toBe("Starlink Enterprise Kit");
    });

    it('handles "more info on X" phrasing', () => {
      expect(
        service.detectDrillDownCandidate("more info on Managed Wi-Fi")
      ).toBe("Managed Wi-Fi");
    });

    it('handles "describe X" phrasing', () => {
      expect(service.detectDrillDownCandidate("describe IP-VPN")).toBe("IP-VPN");
    });

    it('handles "what is X" phrasing', () => {
      expect(service.detectDrillDownCandidate("what is DRaaS?")).toBe("DRaaS");
    });

    it("strips trailing punctuation/question marks", () => {
      expect(
        service.detectDrillDownCandidate("Tell me more about SD-WAN.")
      ).toBe("SD-WAN");
      expect(
        service.detectDrillDownCandidate("Tell me more about SD-WAN?")
      ).toBe("SD-WAN");
    });

    it("returns null for non-drilldown messages", () => {
      expect(
        service.detectDrillDownCandidate("We need protection against cyber attacks")
      ).toBeNull();
      expect(
        service.detectDrillDownCandidate("I run a small office with 10 people")
      ).toBeNull();
      expect(service.detectDrillDownCandidate("hello")).toBeNull();
    });

    it("returns null for empty / whitespace input", () => {
      expect(service.detectDrillDownCandidate("")).toBeNull();
      expect(service.detectDrillDownCandidate("   ")).toBeNull();
    });

    it("returns null when no specific product is named after the trigger phrase", () => {
      expect(service.detectDrillDownCandidate("tell me more")).toBeNull();
      expect(service.detectDrillDownCandidate("tell me more about it")).toBeNull();
    });
  });

  describe("tryDrillDownLookup", () => {
    it("returns a formatted reply when ItemSearchService finds a matching product", async () => {
      const mockItem: EnrichedItem = {
        id: 42,
        name: "Fiber Broadband PEAK 50-100 mbps",
        description:
          "Symmetric fiber broadband with peak speeds between 50 and 100 mbps. Ideal for small offices.",
        price: null,
        contractTerm: null,
        itemType: "product",
        parentItem: null,
        targetAudience: null,
        features: [],
      };

      const mockSearch: Pick<ItemSearchService, "searchByNames"> = {
        searchByNames: vi.fn().mockResolvedValue([mockItem]),
      };

      const result = await service.tryDrillDownLookup(
        "Tell me more about Fiber Broadband PEAK 50-100 mbps",
        mockSearch as ItemSearchService
      );

      expect(result).not.toBeNull();
      expect(result!.reply).toContain("Fiber Broadband PEAK 50-100 mbps");
      expect(result!.reply).toContain(
        "Symmetric fiber broadband with peak speeds between 50 and 100 mbps"
      );
      expect(result!.items).toEqual([mockItem]);
      // Assert first positional arg only — implementation may pass excludedIds
      // and a limit as further args.
      expect(mockSearch.searchByNames).toHaveBeenCalledTimes(1);
      const callArgs = (mockSearch.searchByNames as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect(callArgs[0]).toEqual(["Fiber Broadband PEAK 50-100 mbps"]);
    });

    it("returns null when no product matches (caller should fall through to LLM)", async () => {
      const mockSearch: Pick<ItemSearchService, "searchByNames"> = {
        searchByNames: vi.fn().mockResolvedValue([]),
      };

      const result = await service.tryDrillDownLookup(
        "Tell me more about UnknownProduct",
        mockSearch as ItemSearchService
      );

      expect(result).toBeNull();
    });

    it("returns null when message is not a drill-down (no DB call made)", async () => {
      const mockSearch: Pick<ItemSearchService, "searchByNames"> = {
        searchByNames: vi.fn().mockResolvedValue([]),
      };

      const result = await service.tryDrillDownLookup(
        "We need protection against cyber attacks",
        mockSearch as ItemSearchService
      );

      expect(result).toBeNull();
      expect(mockSearch.searchByNames).not.toHaveBeenCalled();
    });
  });
});
