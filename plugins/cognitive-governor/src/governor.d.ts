/**
 * Cognitive Governor - Main Class
 * Manages context compression, instruction anchoring, and knowledge storage
 */
import { CognitiveGovernorConfig, ConversationMessage, CompressedContext, Anchor, KnowledgeEntry, ContextHealth, KnowledgeQuery } from './types';
export declare class CognitiveGovernor {
    private config;
    private compressedHistory;
    private anchors;
    private knowledgeBase;
    constructor(config: CognitiveGovernorConfig);
    /**
     * Compress a conversation to fit within token limits
     * Returns the compressed messages + any preserved anchors
     */
    compressContext(messages: ConversationMessage[]): {
        compressed: ConversationMessage[];
        summary: CompressedContext;
        anchors: Anchor[];
    };
    /**
     * Smart compression: keep system messages + recent N messages + summarize middle
     */
    private smartStrategy;
    /**
     * Truncate: keep only recent messages
     */
    private truncateStrategy;
    /**
     * Summarize: create a single summary of all but the last few messages
     */
    private summarizeStrategy;
    private buildMiddleSummary;
    private buildCompressionSummary;
    /**
     * Add a critical instruction anchor
     */
    addAnchor(instruction: string, priority?: number, tags?: string[], expiresAt?: Date): Anchor;
    /**
     * Remove an anchor
     */
    removeAnchor(id: string): boolean;
    /**
     * Get all active anchors, sorted by priority
     */
    getActiveAnchors(): Anchor[];
    /**
     * Generate the anchor injection text for prompt
     */
    generateAnchorInjection(): string;
    /**
     * Store a knowledge entry from a solved problem
     */
    storeKnowledge(problem: string, solution: string, tags?: string[]): KnowledgeEntry;
    /**
     * Search knowledge base for relevant entries
     */
    searchKnowledge(query: KnowledgeQuery): KnowledgeEntry[];
    /**
     * Mark a knowledge entry as used
     */
    useKnowledge(id: string): void;
    /**
     * Get context health metrics
     */
    getHealth(messages?: ConversationMessage[]): ContextHealth;
    /**
     * Get compression history
     */
    getCompressionHistory(): CompressedContext[];
    /**
     * Get all knowledge entries
     */
    getKnowledgeEntries(): KnowledgeEntry[];
    private countTokens;
    private extractTopics;
    private countRoles;
    private createEmptySummary;
    private loadPersistedData;
    private savePersistedData;
    /**
     * Stop and save
     */
    stop(): void;
}
