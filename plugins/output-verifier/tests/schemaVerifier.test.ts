/**
 * Schema Verifier Tests
 */

import { SchemaVerifier } from '../src/verifiers/schemaVerifier';
import { AgentClaim, SchemaVerifierConfig } from '../src/types';

function createClaim(output: unknown): AgentClaim {
  return {
    id: 'test-claim-1',
    timestamp: new Date(),
    description: 'Test claim',
    output,
  };
}

describe('SchemaVerifier', () => {
  describe('basic validation', () => {
    it('should fail on null output', async () => {
      const verifier = new SchemaVerifier({ enabled: true });
      const result = await verifier.verify(createClaim(null));
      expect(result.status).toBe('failed');
      expect(result.score).toBe(0);
    });

    it('should fail on undefined output', async () => {
      const verifier = new SchemaVerifier({ enabled: true });
      const result = await verifier.verify(createClaim(undefined));
      expect(result.status).toBe('failed');
    });

    it('should pass on valid object output', async () => {
      const verifier = new SchemaVerifier({ enabled: true });
      const result = await verifier.verify(createClaim({ name: 'Alice', age: 30 }));
      expect(result.status).toBe('passed');
    });

    it('should pass on valid string output', async () => {
      const verifier = new SchemaVerifier({ enabled: true });
      const result = await verifier.verify(createClaim('Hello World'));
      expect(result.status).toBe('passed');
    });

    it('should detect empty string', async () => {
      const verifier = new SchemaVerifier({ enabled: true });
      const result = await verifier.verify(createClaim('   '));
      expect(result.status).not.toBe('passed');
      expect(result.score).toBeLessThan(100);
    });

    it('should detect placeholder text', async () => {
      const verifier = new SchemaVerifier({ enabled: true });
      const result = await verifier.verify(createClaim('TODO: implement this'));
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('schema validation', () => {
    it('should validate object against schema', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
        },
      };
      const verifier = new SchemaVerifier(config);
      const result = await verifier.verify(createClaim({ name: 'Alice', age: 30 }));
      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
    });

    it('should detect missing required fields', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'email'],
        },
      };
      const verifier = new SchemaVerifier(config);
      const result = await verifier.verify(createClaim({ name: 'Alice' }));
      expect(result.status).not.toBe('passed');
      expect(result.details.some(d => d.field === 'email' && !d.passed)).toBe(true);
    });

    it('should detect wrong type', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            age: { type: 'number' },
          },
        },
      };
      const verifier = new SchemaVerifier(config);
      const result = await verifier.verify(createClaim({ age: 'thirty' }));
      expect(result.status).not.toBe('passed');
    });

    it('should validate enum values', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'string',
          enum: ['red', 'green', 'blue'],
        },
      };
      const verifier = new SchemaVerifier(config);
      const pass = await verifier.verify(createClaim('red'));
      expect(pass.status).toBe('passed');
      const fail = await verifier.verify(createClaim('yellow'));
      expect(fail.status).not.toBe('passed');
    });

    it('should validate array items', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
          },
          minItems: 1,
        },
      };
      const verifier = new SchemaVerifier(config);

      const valid = await verifier.verify(createClaim([{ id: 1, name: 'Alice' }]));
      expect(valid.status).toBe('passed');

      const invalid = await verifier.verify(createClaim([{ id: 1 }]));
      expect(invalid.status).not.toBe('passed');
    });

    it('should validate string length', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'string',
          minLength: 5,
          maxLength: 10,
        },
      };
      const verifier = new SchemaVerifier(config);

      const valid = await verifier.verify(createClaim('hello'));
      expect(valid.status).toBe('passed');

      const tooShort = await verifier.verify(createClaim('hi'));
      expect(tooShort.status).not.toBe('passed');

      const tooLong = await verifier.verify(createClaim('this is way too long'));
      expect(tooLong.status).not.toBe('passed');
    });

    it('should validate number range', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      };
      const verifier = new SchemaVerifier(config);

      const valid = await verifier.verify(createClaim(50));
      expect(valid.status).toBe('passed');

      const below = await verifier.verify(createClaim(-1));
      expect(below.status).not.toBe('passed');

      const above = await verifier.verify(createClaim(101));
      expect(above.status).not.toBe('passed');
    });
  });

  describe('required fields', () => {
    it('should check required fields without schema', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        requiredFields: ['id', 'status', 'data'],
      };
      const verifier = new SchemaVerifier(config);

      const complete = await verifier.verify(createClaim({ id: 1, status: 'ok', data: {} }));
      expect(complete.status).toBe('passed');

      const incomplete = await verifier.verify(createClaim({ id: 1 }));
      expect(incomplete.status).not.toBe('passed');
    });
  });

  describe('canVerify', () => {
    it('should verify claims with output', () => {
      const verifier = new SchemaVerifier({ enabled: true });
      expect(verifier.canVerify(createClaim({ a: 1 }))).toBe(true);
      expect(verifier.canVerify(createClaim('hello'))).toBe(true);
    });

    it('should not verify claims without output', () => {
      const verifier = new SchemaVerifier({ enabled: true });
      expect(verifier.canVerify(createClaim(undefined))).toBe(false);
      expect(verifier.canVerify(createClaim(null))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle deeply nested objects', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                profile: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
              required: ['profile'],
            },
          },
          required: ['user'],
        },
      };
      const verifier = new SchemaVerifier(config);

      const valid = await verifier.verify(createClaim({ user: { profile: { name: 'Alice' } } }));
      expect(valid.status).toBe('passed');

      const invalid = await verifier.verify(createClaim({ user: { profile: {} } }));
      expect(invalid.status).not.toBe('passed');
    });

    it('should handle JSON string output', async () => {
      const config: SchemaVerifierConfig = {
        enabled: true,
        requiredFields: ['name'],
      };
      const verifier = new SchemaVerifier(config);
      // String that is valid JSON
      const result = await verifier.verify(createClaim('{"name": "Alice"}'));
      expect(result.status).toBe('passed');
    });
  });
});
