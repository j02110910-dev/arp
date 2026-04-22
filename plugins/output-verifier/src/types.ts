/**
 * Output Verifier - Type Definitions
 * Core types for the agent output verification system
 */

/** Verification result status */
export type VerificationStatus = 'passed' | 'failed' | 'partial' | 'skipped' | 'error';

/** Verification strictness level */
export type StrictnessLevel = 'lenient' | 'standard' | 'strict';

/** Type of verifier */
export type VerifierType =
  | 'schema'      // JSON/structured output schema validation
  | 'data'        // Database/data store verification
  | 'api'         // API endpoint verification
  | 'screenshot'  // Screenshot visual comparison
  | 'e2e';        // End-to-end test replay

/** Agent's claim about what it accomplished */
export interface AgentClaim {
  /** Unique ID for this claim */
  id: string;
  /** Timestamp when the agent claimed completion */
  timestamp: Date;
  /** What the agent said it did */
  description: string;
  /** The actual output/data the agent produced */
  output?: unknown;
  /** Screenshot path if UI was involved */
  screenshotPath?: string;
  /** Tool calls the agent made during execution */
  toolCalls?: ToolCallRecord[];
  /** Metadata about the task */
  metadata?: Record<string, unknown>;
}

/** Record of a tool call made during agent execution */
export interface ToolCallRecord {
  tool: string;
  args?: Record<string, unknown>;
  result?: unknown;
  duration?: number;
  timestamp?: Date;
}

/** Result of a single verification */
export interface VerificationResult {
  /** Unique ID */
  id: string;
  /** Which claim this verifies */
  claimId: string;
  /** What type of verifier ran */
  verifierType: VerifierType;
  /** Overall result */
  status: VerificationStatus;
  /** Score 0-100 (100 = perfect match) */
  score: number;
  /** Human-readable summary */
  message: string;
  /** Detailed findings */
  details: VerificationDetail[];
  /** Timestamp of verification */
  timestamp: Date;
  /** How long verification took */
  durationMs: number;
  /** Suggested fix if failed */
  suggestedFix?: string;
  /** Evidence supporting the result */
  evidence?: VerificationEvidence;
}

/** Individual detail in a verification result */
export interface VerificationDetail {
  /** What was checked */
  field: string;
  /** Expected value */
  expected?: unknown;
  /** Actual value found */
  actual?: unknown;
  /** Did this check pass? */
  passed: boolean;
  /** Human-readable explanation */
  message: string;
}

/** Evidence supporting verification result */
export interface VerificationEvidence {
  /** Screenshot before agent action */
  beforeScreenshot?: string;
  /** Screenshot after agent action */
  afterScreenshot?: string;
  /** AI visual analysis result */
  visualAnalysis?: string;
  /** Database/API query results */
  queryResults?: unknown;
  /** Schema validation errors */
  schemaErrors?: string[];
  /** E2E test output */
  testOutput?: string;
}

/** Configuration for a single verifier */
export interface VerifierConfig {
  /** Enable this verifier */
  enabled: boolean;
  /** Verifier-specific settings */
  settings?: Record<string, unknown>;
}

/** Schema validation specific config */
export interface SchemaVerifierConfig extends VerifierConfig {
  /** JSON Schema to validate against */
  schema?: Record<string, unknown>;
  /** Path to schema file */
  schemaPath?: string;
  /** Allow extra properties not in schema */
  additionalProperties?: boolean;
  /** Required fields that must be present */
  requiredFields?: string[];
}

/** Data/API verification specific config */
export interface DataVerifierConfig extends VerifierConfig {
  /** API base URL to verify against */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Timeout in ms */
  timeoutMs?: number;
  /** Expected status codes */
  expectedStatusCodes?: number[];
  /** Custom suggested fix message for failed verifications */
  suggestedFixMessage?: string;
}

/** Screenshot verification specific config */
export interface ScreenshotVerifierConfig extends VerifierConfig {
  /** Model to use for visual analysis */
  model?: string;
  /** API key for vision model */
  apiKey?: string;
  /** Threshold for visual similarity (0-1) */
  similarityThreshold?: number;
}

/** Main Output Verifier configuration */
export interface OutputVerifierConfig {
  /** Enable/disable the entire verifier */
  enabled: boolean;
  /** Strictness level */
  strictness: StrictnessLevel;
  /** Per-verifier configs */
  verifiers: {
    schema?: SchemaVerifierConfig;
    data?: DataVerifierConfig;
    api?: DataVerifierConfig;
    screenshot?: ScreenshotVerifierConfig;
    e2e?: VerifierConfig;
  };
  /** Notification channels (reuse SilentWatch pattern) */
  notifiers?: {
    console?: { enabled: boolean; level?: string };
    wechat?: { enabled: boolean; server酱Key?: string };
    telegram?: { enabled: boolean; botToken?: string; chatId?: string };
    email?: {
      enabled: boolean;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPass?: string;
      toEmail?: string;
    };
  };
  /** Path to save verification reports */
  reportPath?: string;
  /** Max reports to keep */
  maxReports?: number;
  /** Callback on verification complete */
  onVerification?: (result: VerificationResult) => void;
}

/** Aggregated verification report for a claim */
export interface VerificationReport {
  /** Report ID */
  id: string;
  /** The claim being verified */
  claim: AgentClaim;
  /** All verification results */
  results: VerificationResult[];
  /** Overall status */
  overallStatus: VerificationStatus;
  /** Overall score (average of all results) */
  overallScore: number;
  /** Timestamp */
  timestamp: Date;
  /** Total duration */
  totalDurationMs: number;
  /** Summary message */
  summary: string;
}

/** Verifier interface - all verifiers implement this */
export interface Verifier {
  /** Verifier type identifier */
  type: VerifierType;
  /** Human-readable name */
  name: string;
  /** Verify a claim and return results */
  verify(claim: AgentClaim): Promise<VerificationResult>;
  /** Check if this verifier can handle the given claim */
  canVerify(claim: AgentClaim): boolean;
}
