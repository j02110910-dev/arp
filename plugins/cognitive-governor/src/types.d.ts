/**
 * Cognitive Governor - Type Definitions
 * Memory and context management for AI agents
 */
/** A single message in the conversation */
export interface ConversationMessage {
    /** Message role */
    role: 'system' | 'user' | 'assistant' | 'tool';
    /** Message content */
    content: string;
    /** Timestamp */
    timestamp?: Date;
    /** Token count (estimated) */
    tokenCount?: number;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
}
/** Compressed context summary */
export interface CompressedContext {
    /** Unique ID */
    id: string;
    /** Original message count */
    originalMessageCount: number;
    /** Compressed summary text */
    summary: string;
    /** Estimated token savings */
    tokensSaved: number;
    /** Timestamp range covered */
    timeRange: {
        start: Date;
        end: Date;
    };
    /** Key topics/instructions preserved */
    preservedTopics: string[];
    /** Timestamp of compression */
    timestamp: Date;
}
/** A critical instruction anchor */
export interface Anchor {
    /** Anchor ID */
    id: string;
    /** The instruction text */
    instruction: string;
    /** Priority (higher = more important) */
    priority: number;
    /** When this anchor was created */
    createdAt: Date;
    /** When it should expire (optional) */
    expiresAt?: Date;
    /** Tags for categorization */
    tags?: string[];
}
/** Knowledge entry stored from solved problems */
export interface KnowledgeEntry {
    /** Unique ID */
    id: string;
    /** Problem description */
    problem: string;
    /** Solution that worked */
    solution: string;
    /** Context/tags for matching */
    tags: string[];
    /** Usage count */
    useCount: number;
    /** Timestamp created */
    createdAt: Date;
    /** Last used */
    lastUsedAt?: Date;
    /** Relevance score (0-1) */
    relevanceScore: number;
}
/** Context health metrics */
export interface ContextHealth {
    /** Total token count */
    totalTokens: number;
    /** Token limit */
    tokenLimit: number;
    /** Usage percentage */
    usagePercent: number;
    /** Number of messages */
    messageCount: number;
    /** Number of compressed summaries */
    compressedSummaries: number;
    /** Active anchors */
    activeAnchors: number;
    /** Stored knowledge entries */
    knowledgeEntries: number;
    /** Health status */
    status: 'healthy' | 'warning' | 'critical';
}
/** Compression strategy */
export type CompressionStrategy = 'summarize' | 'truncate' | 'smart';
/** Cognitive Governor configuration */
export interface CognitiveGovernorConfig {
    /** Enable/disable */
    enabled: boolean;
    /** Token limit for context (default: 8000) */
    tokenLimit: number;
    /** Compression threshold (compress when usage exceeds this %) */
    compressionThreshold: number;
    /** Compression strategy */
    compressionStrategy: CompressionStrategy;
    /** Max anchors to keep active */
    maxAnchors: number;
    /** Max knowledge entries */
    maxKnowledgeEntries: number;
    /** File path for persistence */
    persistencePath?: string;
    /** Custom token counter (default: estimate by chars/4) */
    tokenCounter?: (text: string) => number;
}
/** Knowledge search query */
export interface KnowledgeQuery {
    /** Search text */
    text: string;
    /** Tags to match */
    tags?: string[];
    /** Max results */
    limit?: number;
    /** Min relevance score */
    minScore?: number;
}
