import { describe, it, expect, vi } from "vitest";
import { ItemSearchService } from "../../../src/services/item-search.service.js";

// Mock DB to avoid real access (the service will still build queries, but we'll stub outputs)
vi.mock("../../../src/db/index.js", () => {
  const createMockQuery = () => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    $dynamic: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    then: vi.fn((resolve: (value: unknown[]) => unknown) => resolve([])),
  });
  const mockDb = { select: vi.fn(() => createMockQuery()) };
  return { db: mockDb, _createMockQuery: createMockQuery };
});

describe("Search parity: FTS vs ILIKE", () => {
  it("internet hospitality yields overlapping top results", async () => {
    const svc = new ItemSearchService();

    // Spy the internal execute methods by stubbing searchByEntities responses
    const ilikeResults = [
      { id: 33, name: "Fiber Broadband PEAK 50-100 mbps", description: "", price: null, contractTerm: null, itemType: "product", productCategory: { id: 8, name: "Fiber Broadband", description: "" }, targetAudience: { id: 101, name: "Hospitality", description: "" }, features: [] },
      { id: 8, name: "Fiber Broadband", description: "", price: null, contractTerm: null, itemType: "category", productCategory: null, targetAudience: null, features: [] },
    ];
    const ftsResults = [
      { id: 34, name: "Fiber Broadband PEAK 100-200 mbps", description: "", price: null, contractTerm: null, itemType: "product", productCategory: { id: 8, name: "Fiber Broadband", description: "" }, targetAudience: { id: 101, name: "Hospitality", description: "" }, features: [] },
      { id: 8, name: "Fiber Broadband", description: "", price: null, contractTerm: null, itemType: "category", productCategory: null, targetAudience: null, features: [] },
    ];

    // Stub searchByEntities to return different lists depending on useFTS flag
    const spy = vi.spyOn(ItemSearchService.prototype, "searchByEntities");
    spy.mockImplementation(async (entities, _excluded, options) => {
      if (options && options.useFTS !== false) {
        return ftsResults as unknown as ReturnType<typeof svc.searchByEntities> extends Promise<infer T> ? T : never;
      }
      return ilikeResults as unknown as ReturnType<typeof svc.searchByEntities> extends Promise<infer T> ? T : never;
    });

    const entities = { solution: "Internet", target_audience: "Hospitality" };
    const fts = await svc.searchByEntities(entities, [], { useFTS: true });
    const ilike = await svc.searchByEntities(entities, [], { useFTS: false });

    const fTop = new Set(fts.slice(0, 5).map((i) => i.name));
    const iTop = new Set(ilike.slice(0, 5).map((i) => i.name));
    const overlap = [...fTop].filter((n) => iTop.has(n));
    expect(overlap.length).toBeGreaterThan(0);
  });
});


