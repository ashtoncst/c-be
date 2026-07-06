import { describe, it, expect, beforeEach } from 'vitest';
import { FewShotExampleService } from '../../src/services/few-shot-example.service.js';

describe('FewShotExampleService', () => {
  let service: FewShotExampleService;

  beforeEach(() => {
    service = new FewShotExampleService('v1');
  });

  describe('loadExamples', () => {
    it('should load examples for discovery stage', async () => {
      const examples = await service.loadExamples('discovery');
      
      expect(examples).toBeDefined();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.length).toBe(5); // 5 discovery examples
    });

    it('should load examples for refinement stage', async () => {
      const examples = await service.loadExamples('refinement');
      
      expect(examples).toBeDefined();
      expect(examples.length).toBe(5); // 5 refinement examples
    });

    it('should load examples for recommendation stage', async () => {
      const examples = await service.loadExamples('recommendation');
      
      expect(examples).toBeDefined();
      expect(examples.length).toBe(9); // 9 recommendation examples
    });

    it('should load examples for feedback stage', async () => {
      const examples = await service.loadExamples('feedback');
      
      expect(examples).toBeDefined();
      expect(examples.length).toBe(10); // 10 feedback examples
    });

    it('should return empty array for non-existent stage', async () => {
      const examples = await service.loadExamples('non-existent');
      
      expect(examples).toEqual([]);
    });

    it('should cache examples after first load', async () => {
      const examples1 = await service.loadExamples('discovery');
      const examples2 = await service.loadExamples('discovery');
      
      expect(examples1).toBe(examples2); // Same reference = cached
    });
  });

  describe('validateExample', () => {
    it('should validate correctly structured example', async () => {
      const examples = await service.loadExamples('discovery');
      
      examples.forEach(example => {
        expect(example.id).toBeDefined();
        expect(example.name).toBeDefined();
        expect(example.conversationStage).toBeDefined();
        expect(example.userQuery).toBeDefined();
        expect(Array.isArray(example.reasoning)).toBe(true);
        expect(example.output).toBeDefined();
        expect(example.output.solution).toBeDefined();
        expect(Array.isArray(example.output.recommendedItems)).toBe(true);
        expect(typeof example.output.confidence).toBe('number');
      });
    });

    it('should have valid product IDs in examples', async () => {
      const stages = ['discovery', 'refinement', 'recommendation', 'feedback'];
      
      for (const stage of stages) {
        const examples = await service.loadExamples(stage);
        
        examples.forEach(example => {
          example.output.recommendedItems.forEach(item => {
            expect(item.id).toBeGreaterThan(0);
            expect(item.id).toBeLessThan(100); // Valid product ID range
            expect(item.name).toBeDefined();
            expect(item.reason).toBeDefined();
          });
        });
      }
    });
  });

  describe('formatExampleForPrompt', () => {
    it('should format example correctly', async () => {
      const examples = await service.loadExamples('discovery');
      const formatted = service.formatExampleForPrompt(examples[0]);
      
      expect(formatted).toContain('EXAMPLE:');
      expect(formatted).toContain('User:');
      expect(formatted).toContain('REASONING:');
      expect(formatted).toContain('OUTPUT:');
      expect(formatted).toContain(examples[0].name);
      expect(formatted).toContain(examples[0].userQuery);
    });

    it('should include context note if present', async () => {
      const examples = await service.loadExamples('refinement');
      const formatted = service.formatExampleForPrompt(examples[0]);
      
      if (examples[0].contextNote) {
        expect(formatted).toContain('Context:');
        expect(formatted).toContain(examples[0].contextNote);
      }
    });
  });

  describe('selectRelevantExamples', () => {
    it('should select correct number of examples', async () => {
      const formatted = await service.selectRelevantExamples('discovery', '', 2);

      expect(formatted).toBeDefined();
      expect(formatted.length).toBeGreaterThan(0);

      // Count separators to verify example count
      const separatorCount = (formatted.match(/---/g) || []).length;
      expect(separatorCount).toBe(1); // 2 examples = 1 separator
    });

    it('should return empty string for non-existent stage', async () => {
      const formatted = await service.selectRelevantExamples('non-existent');

      expect(formatted).toBe('');
    });

    it('should sort examples by effectiveness score', async () => {
      const examples = await service.loadExamples('discovery');

      // Verify examples are sorted by effectiveness score (descending)
      for (let i = 1; i < examples.length; i++) {
        expect(examples[i - 1].metadata.effectivenessScore)
          .toBeGreaterThanOrEqual(examples[i].metadata.effectivenessScore);
      }
    });

    // 🔥 NEW: query-relevance tests (UAT FAIL fixes for IND-002..005, PR-002, PR-003, IND-006)
    it('should rank DRaaS/financial example first for a banking disaster-recovery query', async () => {
      const formatted = await service.selectRelevantExamples(
        'recommendation',
        'Our bank needs a disaster recovery backup plan',
        1,
      );

      expect(formatted).toContain('DraaS');
      expect(formatted).toMatch(/financial|banking/i);
    });

    it('should rank Content/IPTV/Hospital example first for a hospital entertainment query', async () => {
      const formatted = await service.selectRelevantExamples(
        'recommendation',
        'Our hospital needs a TV and entertainment system for patients',
        1,
      );

      expect(formatted).toMatch(/Content\/IPTV|hospital/i);
    });

    it('should rank Starlink/construction example first for a temporary construction-site query', async () => {
      const formatted = await service.selectRelevantExamples(
        'recommendation',
        'We need temporary internet for a construction site',
        1,
      );

      expect(formatted).toMatch(/Starlink|construction/i);
    });

    it('should rank Managed Wi-Fi/hotel example first for a hotel guest Wi-Fi query', async () => {
      const formatted = await service.selectRelevantExamples(
        'recommendation',
        'I manage a hotel in a remote area and need Wi-Fi for guests',
        1,
      );

      expect(formatted).toMatch(/Managed Wi-Fi|hotel/i);
    });

    it('should rank DDoS/security example first for a cyber-attack protection query', async () => {
      const formatted = await service.selectRelevantExamples(
        'recommendation',
        'We need protection against cyber attacks',
        1,
      );

      expect(formatted).toMatch(/DDoS|cybersecurity|security/i);
    });

    it('should rank Metro Ethernet/multi-site example first for a multi-branch connectivity query', async () => {
      const formatted = await service.selectRelevantExamples(
        'recommendation',
        'We have 20 retail branch offices and need to connect them',
        1,
      );

      expect(formatted).toMatch(/Metro Ethernet|multi-site|retail/i);
    });

    it('should fall back to effectivenessScore order when query is empty (back-compat)', async () => {
      const formatted = await service.selectRelevantExamples('recommendation', '', 1);

      // Highest effectivenessScore (0.95) is example-14 starlink-construction
      expect(formatted).toContain('Starlink for Construction Site');
    });

    it('should fall back to effectivenessScore order when query is omitted (legacy callers)', async () => {
      const formatted = await service.selectRelevantExamples('recommendation');

      // Default maxExamples=3 → first should still be highest-effectivenessScore example
      expect(formatted).toContain('Starlink for Construction Site');
    });
  });

  describe('getAvailableStages', () => {
    it('should return list of available stages', async () => {
      const stages = await service.getAvailableStages();
      
      expect(stages).toContain('discovery');
      expect(stages).toContain('refinement');
      expect(stages).toContain('recommendation');
      expect(stages).toContain('feedback');
    });
  });

  describe('getExampleCount', () => {
    it('should return correct count for each stage', async () => {
      const discoveryCount = await service.getExampleCount('discovery');
      const refinementCount = await service.getExampleCount('refinement');
      const recommendationCount = await service.getExampleCount('recommendation');
      const feedbackCount = await service.getExampleCount('feedback');
      
      expect(discoveryCount).toBe(5);
      expect(refinementCount).toBe(5); // Updated: now 5 refinement examples
      expect(recommendationCount).toBe(9);
      expect(feedbackCount).toBe(10); // Updated: now 10 feedback examples
    });
  });

  describe('clearCache', () => {
    it('should clear cache successfully', async () => {
      // Load examples to populate cache
      await service.loadExamples('discovery');
      
      // Clear cache
      service.clearCache();
      
      // Loading again should not return cached version
      // (hard to verify without accessing private properties, but ensures no errors)
      const examples = await service.loadExamples('discovery');
      expect(examples).toBeDefined();
    });
  });
});

