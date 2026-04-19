/**
 * Schema Verifier
 * Validates agent output against JSON Schema or custom rules
 */

import { Verifier, VerifierType, AgentClaim, VerificationResult, SchemaVerifierConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class SchemaVerifier implements Verifier {
  type: VerifierType = 'schema';
  name = 'Schema Verifier';

  private config: SchemaVerifierConfig;

  constructor(config: SchemaVerifierConfig) {
    this.config = config;
  }

  canVerify(claim: AgentClaim): boolean {
    // Can verify if there's output to check
    return claim.output !== undefined && claim.output !== null;
  }

  async verify(claim: AgentClaim): Promise<VerificationResult> {
    const startTime = Date.now();
    const details: VerificationResult['details'] = [];
    let score = 100;
    const errors: string[] = [];

    const output = claim.output;

    // 1. Check if output exists
    if (output === undefined || output === null) {
      return this.buildResult(claim.id, 'failed', 0, 'Agent output is empty/null', details, startTime, errors);
    }

    // 2. Validate against schema if provided
    if (this.config.schema) {
      const schemaErrors = this.validateAgainstSchema(output, this.config.schema, '');
      for (const err of schemaErrors) {
        details.push({
          field: err.path || 'root',
          expected: err.expected,
          actual: err.actual,
          passed: false,
          message: err.message,
        });
        errors.push(err.message);
        score -= 30;
      }

      if (schemaErrors.length === 0) {
        details.push({
          field: 'schema',
          passed: true,
          message: 'Output matches the expected schema',
        });
      }
    }

    // 3. Check required fields
    if (this.config.requiredFields && this.config.requiredFields.length > 0) {
      const obj = typeof output === 'string' ? this.safeParseJSON(output) : output;
      if (obj && typeof obj === 'object') {
        for (const field of this.config.requiredFields) {
          const value = (obj as Record<string, unknown>)[field];
          const exists = value !== undefined && value !== null;
          details.push({
            field,
            passed: exists,
            message: exists ? `Field "${field}" present` : `Required field "${field}" is missing`,
          });
          if (!exists) {
            score -= 25;
            errors.push(`Required field "${field}" is missing`);
          }
        }
      }
    }

    // 4. Check output structure
    if (typeof output === 'object' && output !== null) {
      const keys = Object.keys(output as Record<string, unknown>);
      if (keys.length === 0 && !this.config.additionalProperties) {
        details.push({
          field: 'structure',
          passed: false,
          message: 'Output is an empty object',
        });
        score -= 10;
        errors.push('Output is an empty object');
      } else if (keys.length > 0) {
        details.push({
          field: 'structure',
          passed: true,
          message: `Output has ${keys.length} fields: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`,
        });
      }
    }

    // 5. Check for common issues in string output
    if (typeof output === 'string') {
      // Check for placeholder text
      const placeholders = ['TODO', 'FIXME', 'PLACEHOLDER', 'N/A', 'undefined', 'null'];
      for (const placeholder of placeholders) {
        if (output.includes(placeholder)) {
          details.push({
            field: 'content',
            expected: 'complete output',
            actual: `contains placeholder "${placeholder}"`,
            passed: false,
            message: `Output contains placeholder text: "${placeholder}"`,
          });
          score -= 10;
          errors.push(`Contains placeholder: ${placeholder}`);
        }
      }

      // Check for empty string
      if (output.trim() === '') {
        details.push({
          field: 'content',
          passed: false,
          message: 'Output is empty or whitespace only',
        });
        score -= 30;
        errors.push('Output is empty');
      }
    }

    score = Math.max(0, score);
    const status = score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';
    const message = status === 'passed'
      ? `Schema validation passed (score: ${score}/100)`
      : `Schema validation ${status} (score: ${score}/100) - ${errors.length} issue(s)`;

    return this.buildResult(claim.id, status, score, message, details, startTime, errors);
  }

  private validateAgainstSchema(
    data: unknown,
    schema: Record<string, unknown>,
    path: string
  ): Array<{ path: string; message: string; expected?: unknown; actual?: unknown }> {
    const errors: Array<{ path: string; message: string; expected?: unknown; actual?: unknown }> = [];

    // Type check
    if (schema.type) {
      const expectedType = schema.type as string;
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (actualType !== expectedType) {
        errors.push({
          path,
          message: `Expected type "${expectedType}" at "${path || 'root'}", got "${actualType}"`,
          expected: expectedType,
          actual: actualType,
        });
        return errors;
      }
    }

    // Object properties validation
    if (schema.properties && typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      const properties = schema.properties as Record<string, Record<string, unknown>>;
      const required = (schema.required as string[]) || [];

      // Check required fields
      for (const field of required) {
        if (obj[field] === undefined || obj[field] === null) {
          errors.push({
            path: path ? `${path}.${field}` : field,
            message: `Required field "${path ? `${path}.${field}` : field}" is missing`,
            expected: 'present',
            actual: 'missing',
          });
        }
      }

      // Validate each property
      for (const [key, propSchema] of Object.entries(properties)) {
        if (obj[key] !== undefined) {
          const childErrors = this.validateAgainstSchema(
            obj[key],
            propSchema,
            path ? `${path}.${key}` : key
          );
          errors.push(...childErrors);
        }
      }

      // Check for unexpected properties
      if (schema.additionalProperties === false) {
        const allowedKeys = new Set(Object.keys(properties));
        for (const key of Object.keys(obj)) {
          if (!allowedKeys.has(key)) {
            errors.push({
              path: path ? `${path}.${key}` : key,
              message: `Unexpected property "${path ? `${path}.${key}` : key}"`,
              expected: 'not present',
              actual: key,
            });
          }
        }
      }
    }

    // Array items validation
    if (schema.items && Array.isArray(data)) {
      const itemSchema = schema.items as Record<string, unknown>;
      for (let i = 0; i < data.length; i++) {
        const childErrors = this.validateAgainstSchema(data[i], itemSchema, `${path}[${i}]`);
        errors.push(...childErrors);
      }

      // Min/max items
      if (schema.minItems !== undefined && data.length < (schema.minItems as number)) {
        errors.push({
          path,
          message: `Array at "${path || 'root'}" has ${data.length} items, minimum is ${schema.minItems}`,
          expected: `>=${schema.minItems}`,
          actual: data.length,
        });
      }
      if (schema.maxItems !== undefined && data.length > (schema.maxItems as number)) {
        errors.push({
          path,
          message: `Array at "${path || 'root'}" has ${data.length} items, maximum is ${schema.maxItems}`,
          expected: `<=${schema.maxItems}`,
          actual: data.length,
        });
      }
    }

    // Enum validation
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!(schema.enum as unknown[]).includes(data)) {
        errors.push({
          path,
          message: `Value at "${path || 'root'}" must be one of: ${(schema.enum as string[]).join(', ')}`,
          expected: schema.enum,
          actual: data,
        });
      }
    }

    // String length validation
    if (typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < (schema.minLength as number)) {
        errors.push({
          path,
          message: `String at "${path || 'root'}" is too short (${data.length} chars, min ${schema.minLength})`,
          expected: `>=${schema.minLength}`,
          actual: data.length,
        });
      }
      if (schema.maxLength !== undefined && data.length > (schema.maxLength as number)) {
        errors.push({
          path,
          message: `String at "${path || 'root'}" is too long (${data.length} chars, max ${schema.maxLength})`,
          expected: `<=${schema.maxLength}`,
          actual: data.length,
        });
      }
      if (schema.pattern && typeof schema.pattern === 'string') {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          errors.push({
            path,
            message: `String at "${path || 'root'}" does not match pattern "${schema.pattern}"`,
            expected: schema.pattern,
            actual: data,
          });
        }
      }
    }

    // Number range validation
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < (schema.minimum as number)) {
        errors.push({
          path,
          message: `Number at "${path || 'root'}" is below minimum (${data} < ${schema.minimum})`,
        });
      }
      if (schema.maximum !== undefined && data > (schema.maximum as number)) {
        errors.push({
          path,
          message: `Number at "${path || 'root'}" is above maximum (${data} > ${schema.maximum})`,
        });
      }
    }

    return errors;
  }

  private safeParseJSON(str: string): unknown {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  private buildResult(
    claimId: string,
    status: VerificationResult['status'],
    score: number,
    message: string,
    details: VerificationResult['details'],
    startTime: number,
    schemaErrors: string[]
  ): VerificationResult {
    return {
      id: uuidv4(),
      claimId,
      verifierType: this.type,
      status,
      score,
      message,
      details,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
      suggestedFix: status !== 'passed'
        ? '检查 Agent 输出是否完整，确认所有必填字段已返回'
        : undefined,
      evidence: schemaErrors.length > 0
        ? { schemaErrors }
        : undefined,
    };
  }
}
