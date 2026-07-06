// src/services/catalog-lexicon.service.ts

/**
 * CatalogLexiconService: Provides cached lexicon of solution and category names
 *
 * Maintains lists of exact solution and category names from the catalog
 * for fast detection of exact matches in user messages.
 *
 * Used for deterministic entity extraction and pattern matching.
 * Cache TTL: 5 minutes.
 */

import { db } from "../db/index.js";
import { item } from "../models/schema.model.js";
import { eq } from "drizzle-orm";

export class CatalogLexiconService {
  private solutions: string[] = [];
  private categories: string[] = [];
  private lastLoadedAt = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000;

  private async ensureCache(): Promise<void> {
    const now = Date.now();
    if (
      now - this.lastLoadedAt < this.cacheTtlMs &&
      this.solutions.length > 0 &&
      this.categories.length > 0
    ) {
      return;
    }

    const [solutions, categories] = await Promise.all([
      db
        .select({ name: item.name })
        .from(item)
        .where(eq(item.itemType, "solution")),
      db
        .select({ name: item.name })
        .from(item)
        .where(eq(item.itemType, "category")),
    ]);

    this.solutions = solutions.map((r) => r.name).filter(Boolean);
    this.categories = categories.map((r) => r.name).filter(Boolean);
    this.lastLoadedAt = now;
  }

  private detect(text: string, list: string[]): string | null {
    const lower = text.toLowerCase();
    let best: { name: string; len: number } | null = null;
    for (const name of list) {
      const n = name.toLowerCase();
      if (lower.includes(n)) {
        if (!best || n.length > best.len) best = { name, len: n.length };
      }
    }
    return best ? best.name : null;
  }

  async detectSolution(text: string): Promise<string | null> {
    await this.ensureCache();
    return this.detect(text, this.solutions);
  }

  async detectCategory(text: string): Promise<string | null> {
    await this.ensureCache();
    return this.detect(text, this.categories);
  }
}
