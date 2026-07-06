// src/services/few-shot-example.service.ts

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FewShotExample {
  id: string;
  name: string;
  version: string;
  conversationStage: string;
  userQuery: string;
  contextNote?: string;
  reasoning: string[];
  output: {
    solution: string;
    category: string | null;
    recommendedItems: Array<{
      id: number;
      name: string;
      reason: string;
    }>;
    reply: string;
    confidence: number;
  };
  metadata: {
    tags: string[];
    effectivenessScore: number;
    usageCount: number;
    lastUpdated: string;
    notes: string;
  };
}

export class FewShotExampleService {
  private exampleCache: Map<string, FewShotExample[]> = new Map();
  private version: string;
  private logger: Logger;
  private basePath: string;

  constructor(version: string = 'v1') {
    this.version = version;
    this.logger = new Logger({ serviceName: 'FewShotExampleService' });
    this.basePath = path.join(__dirname, '../prompts/few-shot-examples', this.version);
  }

  /**
   * Load examples for a specific conversation stage
   * Results are cached in memory for performance
   */
  async loadExamples(stage: string): Promise<FewShotExample[]> {
    const cacheKey = `${this.version}-${stage}`;

    // Return cached if available
    if (this.exampleCache.has(cacheKey)) {
      this.logger.debug('Using cached examples', { stage, version: this.version });
      return this.exampleCache.get(cacheKey)!;
    }

    try {
      const examplesDir = path.join(this.basePath, stage);
      
      // Check if directory exists
      try {
        await fs.access(examplesDir);
      } catch {
        this.logger.warn('Examples directory not found', { stage, path: examplesDir });
        return [];
      }

      const files = await fs.readdir(examplesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        this.logger.warn('No example files found', { stage, directory: examplesDir });
        return [];
      }

      const examples: FewShotExample[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(examplesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const example = JSON.parse(content) as FewShotExample;
          
          // Validate required fields
          if (this.validateExample(example)) {
            examples.push(example);
          } else {
            this.logger.warn('Invalid example format', { file, stage });
          }
        } catch (error) {
          this.logger.error('Failed to load example file', error as Error, { file });
        }
      }

      // Sort by effectiveness score (highest first)
      examples.sort((a, b) => 
        b.metadata.effectivenessScore - a.metadata.effectivenessScore
      );

      // Cache the results
      this.exampleCache.set(cacheKey, examples);

      this.logger.info('Loaded examples successfully', {
        stage,
        count: examples.length,
        version: this.version,
      });

      return examples;
    } catch (error) {
      this.logger.error('Failed to load examples', error as Error, { stage });
      return [];
    }
  }

  /**
   * Validate example structure
   */
  private validateExample(example: unknown): example is FewShotExample {
    if (!example || typeof example !== 'object') {
      return false;
    }

    const ex = example as Record<string, unknown>;

    // Validate top-level fields
    if (typeof ex.id !== 'string') return false;
    if (typeof ex.name !== 'string') return false;
    if (typeof ex.conversationStage !== 'string') return false;
    if (typeof ex.userQuery !== 'string') return false;
    if (!Array.isArray(ex.reasoning)) return false;

    // Validate output object
    if (!ex.output || typeof ex.output !== 'object') return false;
    const output = ex.output as Record<string, unknown>;
    
    if (typeof output.solution !== 'string') return false;
    if (!Array.isArray(output.recommendedItems)) return false;
    if (typeof output.reply !== 'string') return false;
    if (typeof output.confidence !== 'number') return false;

    return true;
  }

  /**
   * Format example for inclusion in prompt
   */
  formatExampleForPrompt(example: FewShotExample): string {
    const contextNote = example.contextNote 
      ? `Context: ${example.contextNote}\n\n` 
      : '';

    return `
EXAMPLE: ${example.name}
${contextNote}User: "${example.userQuery}"

REASONING:
${example.reasoning.map((r, i) => `${i + 1}. ${r}`).join('\n')}

OUTPUT:
${JSON.stringify(example.output, null, 2)}
`;
  }

  /**
   * Select relevant examples for a conversation stage.
   *
   * When `query` is non-empty, examples are ranked by token-overlap with the
   * user's current message (matches in `userQuery`, `metadata.tags`, and
   * recommended item names). The static `effectivenessScore` is used as a
   * tiebreaker only.
   *
   * When `query` is empty/undefined, falls back to `effectivenessScore` order
   * (legacy behaviour) so old callers still work.
   *
   * Returns formatted string ready for prompt inclusion.
   */
  async selectRelevantExamples(
    stage: string,
    query: string = '',
    maxExamples: number = 3
  ): Promise<string> {
    const examples = await this.loadExamples(stage);

    if (examples.length === 0) {
      this.logger.warn('No examples available for stage', { stage });
      return '';
    }

    const tokens = this.tokenizeQuery(query);

    let ordered: FewShotExample[];
    if (tokens.length === 0) {
      // No usable query → keep the existing effectivenessScore-sorted order
      ordered = examples;
    } else {
      const scored = examples.map(ex => ({
        ex,
        score: this.scoreExampleAgainstQuery(ex, tokens),
      }));
      scored.sort((a, b) => b.score - a.score);
      ordered = scored.map(s => s.ex);
    }

    const selectedExamples = ordered.slice(0, maxExamples);

    // Format and join with separator
    const formattedExamples = selectedExamples
      .map(ex => this.formatExampleForPrompt(ex))
      .join('\n---\n');

    this.logger.debug('Selected examples for prompt', {
      stage,
      count: selectedExamples.length,
      ids: selectedExamples.map(e => e.id),
      queryTokens: tokens.length > 0 ? tokens : undefined,
    });

    return formattedExamples;
  }

  /**
   * Tokenize the user query for keyword-overlap scoring.
   * Lowercases, strips punctuation, drops short tokens and a small stopword set.
   */
  private tokenizeQuery(query: string): string[] {
    if (!query || typeof query !== 'string') {
      return [];
    }
    const stopwords = new Set([
      'the', 'and', 'for', 'our', 'with', 'have', 'has', 'had', 'are', 'was',
      'were', 'this', 'that', 'these', 'those', 'will', 'would', 'could',
      'should', 'about', 'from', 'into', 'than', 'them', 'they', 'their',
      'there', 'what', 'when', 'where', 'which', 'who', 'how', 'why',
      'you', 'your', 'yours', 'can', 'just', 'need', 'needs', 'want',
      'wants', 'looking', 'help', 'please', 'some', 'any', 'all', 'one',
    ]);
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && !stopwords.has(t));
  }

  /**
   * Score a single example against tokenised query.
   * Higher = more relevant.
   */
  private scoreExampleAgainstQuery(
    example: FewShotExample,
    queryTokens: string[]
  ): number {
    const userQueryLower = (example.userQuery || '').toLowerCase();
    const tagSet = new Set(
      (example.metadata?.tags || []).map(t => t.toLowerCase())
    );
    const itemNamesLower = (example.output?.recommendedItems || [])
      .map(it => (it.name || '').toLowerCase())
      .join(' ');

    let score = 0;
    for (const token of queryTokens) {
      if (userQueryLower.includes(token)) {
        score += 2.0;
      }
      // Tag match: exact OR token-substring (e.g. "bank" matches "banking")
      for (const tag of tagSet) {
        if (tag === token || tag.includes(token) || token.includes(tag)) {
          score += 1.5;
          break;
        }
      }
      if (itemNamesLower.includes(token)) {
        score += 1.0;
      }
    }

    // Tiebreaker: small bump from static effectiveness score
    const eff = example.metadata?.effectivenessScore ?? 0;
    return score + eff * 0.1;
  }

  /**
   * Clear cache (useful for hot-reloading in development)
   */
  clearCache(): void {
    this.exampleCache.clear();
    this.logger.info('Example cache cleared');
  }

  /**
   * Get all available stages
   */
  async getAvailableStages(): Promise<string[]> {
    try {
      const dirs = await fs.readdir(this.basePath, { withFileTypes: true });
      return dirs
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    } catch (error) {
      this.logger.error('Failed to get available stages', error as Error);
      return [];
    }
  }

  /**
   * Get example count by stage
   */
  async getExampleCount(stage: string): Promise<number> {
    const examples = await this.loadExamples(stage);
    return examples.length;
  }
}

