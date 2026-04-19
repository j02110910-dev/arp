"use strict";
/**
 * Cognitive Governor - Main Class
 * Manages context compression, instruction anchoring, and knowledge storage
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitiveGovernor = void 0;
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
class CognitiveGovernor {
    config;
    compressedHistory = [];
    anchors = new Map();
    knowledgeBase = new Map();
    constructor(config) {
        this.config = config;
        this.loadPersistedData();
    }
    // ─── Context Compression ───────────────────────────────────
    /**
     * Compress a conversation to fit within token limits
     * Returns the compressed messages + any preserved anchors
     */
    compressContext(messages) {
        const totalTokens = this.countTokens(messages);
        const limit = this.config.tokenLimit;
        const threshold = limit * this.config.compressionThreshold;
        // No compression needed
        if (totalTokens <= threshold) {
            return {
                compressed: messages,
                summary: this.createEmptySummary(),
                anchors: this.getActiveAnchors(),
            };
        }
        // Apply compression strategy
        let compressed;
        switch (this.config.compressionStrategy) {
            case 'summarize':
                compressed = this.summarizeStrategy(messages);
                break;
            case 'truncate':
                compressed = this.truncateStrategy(messages);
                break;
            case 'smart':
            default:
                compressed = this.smartStrategy(messages);
                break;
        }
        // Build summary
        const newTokens = this.countTokens(compressed);
        const summary = {
            id: (0, uuid_1.v4)(),
            originalMessageCount: messages.length,
            summary: this.buildCompressionSummary(messages, compressed),
            tokensSaved: totalTokens - newTokens,
            timeRange: {
                start: messages[0]?.timestamp || new Date(),
                end: messages[messages.length - 1]?.timestamp || new Date(),
            },
            preservedTopics: this.extractTopics(messages),
            timestamp: new Date(),
        };
        this.compressedHistory.push(summary);
        // Limit in-memory history to prevent memory leak
        if (this.compressedHistory.length > 50) {
            this.compressedHistory = this.compressedHistory.slice(-50);
        }
        this.savePersistedData();
        return {
            compressed,
            summary,
            anchors: this.getActiveAnchors(),
        };
    }
    /**
     * Smart compression: keep system messages + recent N messages + summarize middle
     */
    smartStrategy(messages) {
        const keepRecent = Math.max(5, Math.floor(messages.length * 0.3));
        const result = [];
        // Always keep system messages
        const systemMessages = messages.filter(m => m.role === 'system');
        result.push(...systemMessages);
        // Keep first user message (usually the initial task)
        const firstUser = messages.find(m => m.role === 'user');
        if (firstUser && !systemMessages.includes(firstUser)) {
            result.push(firstUser);
        }
        // Summarize the middle section
        const middleStart = systemMessages.length + (firstUser ? 1 : 0);
        const middleEnd = messages.length - keepRecent;
        if (middleEnd > middleStart) {
            const middleMessages = messages.slice(middleStart, middleEnd);
            const summaryContent = this.buildMiddleSummary(middleMessages);
            result.push({
                role: 'system',
                content: `[Context Summary - ${middleMessages.length} messages compressed]\n${summaryContent}`,
                timestamp: new Date(),
            });
        }
        // Keep recent messages
        const recentMessages = messages.slice(-keepRecent);
        for (const msg of recentMessages) {
            if (!result.includes(msg)) {
                result.push(msg);
            }
        }
        return result;
    }
    /**
     * Truncate: keep only recent messages
     */
    truncateStrategy(messages) {
        const keepCount = Math.max(10, Math.floor(this.config.tokenLimit / 200));
        return messages.slice(-keepCount);
    }
    /**
     * Summarize: create a single summary of all but the last few messages
     */
    summarizeStrategy(messages) {
        const keepRecent = 5;
        const older = messages.slice(0, -keepRecent);
        const recent = messages.slice(-keepRecent);
        const summary = this.buildMiddleSummary(older);
        return [
            {
                role: 'system',
                content: `[Full Conversation Summary - ${older.length} messages]\n${summary}`,
                timestamp: new Date(),
            },
            ...recent,
        ];
    }
    buildMiddleSummary(messages) {
        const topics = this.extractTopics(messages);
        const toolCalls = messages
            .filter(m => m.role === 'assistant' && m.content.includes('tool'))
            .map(m => m.content.substring(0, 100));
        let summary = '';
        if (topics.length > 0) {
            summary += `Topics discussed: ${topics.join(', ')}\n`;
        }
        summary += `Message count: ${messages.length}\n`;
        summary += `Roles: ${this.countRoles(messages)}\n`;
        if (toolCalls.length > 0) {
            summary += `Key actions: ${toolCalls.slice(0, 5).join('; ')}\n`;
        }
        // Extract last user request from middle section
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            summary += `Last request before recent: "${lastUserMsg.content.substring(0, 150)}"\n`;
        }
        return summary;
    }
    buildCompressionSummary(original, compressed) {
        return `Compressed ${original.length} messages → ${compressed.length} messages. ` +
            `Saved ~${this.countTokens(original) - this.countTokens(compressed)} tokens.`;
    }
    // ─── Anchor Management ─────────────────────────────────────
    /**
     * Add a critical instruction anchor
     */
    addAnchor(instruction, priority = 1, tags, expiresAt) {
        const anchor = {
            id: (0, uuid_1.v4)(),
            instruction,
            priority,
            createdAt: new Date(),
            expiresAt,
            tags,
        };
        this.anchors.set(anchor.id, anchor);
        this.savePersistedData();
        return anchor;
    }
    /**
     * Remove an anchor
     */
    removeAnchor(id) {
        const result = this.anchors.delete(id);
        if (result)
            this.savePersistedData();
        return result;
    }
    /**
     * Get all active anchors, sorted by priority
     */
    getActiveAnchors() {
        const now = new Date();
        return Array.from(this.anchors.values())
            .filter(a => !a.expiresAt || a.expiresAt > now)
            .sort((a, b) => b.priority - a.priority)
            .slice(0, this.config.maxAnchors);
    }
    /**
     * Generate the anchor injection text for prompt
     */
    generateAnchorInjection() {
        const anchors = this.getActiveAnchors();
        if (anchors.length === 0)
            return '';
        let text = '\n[Critical Instructions - Always Remember]\n';
        for (const anchor of anchors) {
            text += `- ${anchor.instruction}\n`;
        }
        text += '[End Critical Instructions]\n';
        return text;
    }
    // ─── Knowledge Management ──────────────────────────────────
    /**
     * Store a knowledge entry from a solved problem
     */
    storeKnowledge(problem, solution, tags = []) {
        const entry = {
            id: (0, uuid_1.v4)(),
            problem,
            solution,
            tags,
            useCount: 0,
            createdAt: new Date(),
            relevanceScore: 1.0,
        };
        this.knowledgeBase.set(entry.id, entry);
        this.savePersistedData();
        return entry;
    }
    /**
     * Search knowledge base for relevant entries
     */
    searchKnowledge(query) {
        const results = [];
        const queryLower = query.text.toLowerCase();
        const queryTags = query.tags || [];
        const minScore = query.minScore || 0.1;
        for (const entry of this.knowledgeBase.values()) {
            let score = 0;
            // Text similarity (simple keyword matching)
            const problemWords = entry.problem.toLowerCase().split(/\s+/);
            const queryWords = queryLower.split(/\s+/);
            const matchingWords = queryWords.filter(w => problemWords.some(pw => pw.includes(w) || w.includes(pw)));
            score += matchingWords.length / Math.max(queryWords.length, 1) * 0.5;
            // Tag matching
            if (queryTags.length > 0) {
                const matchingTags = queryTags.filter(t => entry.tags.includes(t));
                score += matchingTags.length / queryTags.length * 0.3;
            }
            // Recency bonus
            const daysSinceCreated = (Date.now() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 1 - daysSinceCreated / 30) * 0.1;
            // Usage bonus
            score += Math.min(entry.useCount / 10, 1) * 0.1;
            if (score >= minScore) {
                results.push({ ...entry, relevanceScore: score });
            }
        }
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);
        return results.slice(0, query.limit || 5);
    }
    /**
     * Mark a knowledge entry as used
     */
    useKnowledge(id) {
        const entry = this.knowledgeBase.get(id);
        if (entry) {
            entry.useCount++;
            entry.lastUsedAt = new Date();
        }
    }
    // ─── Health & Stats ────────────────────────────────────────
    /**
     * Get context health metrics
     */
    getHealth(messages) {
        const totalTokens = messages ? this.countTokens(messages) : 0;
        const usagePercent = Math.round((totalTokens / this.config.tokenLimit) * 100);
        let status = 'healthy';
        if (usagePercent > 90)
            status = 'critical';
        else if (usagePercent > this.config.compressionThreshold * 100)
            status = 'warning';
        return {
            totalTokens,
            tokenLimit: this.config.tokenLimit,
            usagePercent,
            messageCount: messages?.length || 0,
            compressedSummaries: this.compressedHistory.length,
            activeAnchors: this.getActiveAnchors().length,
            knowledgeEntries: this.knowledgeBase.size,
            status,
        };
    }
    /**
     * Get compression history
     */
    getCompressionHistory() {
        return [...this.compressedHistory];
    }
    /**
     * Get all knowledge entries
     */
    getKnowledgeEntries() {
        return Array.from(this.knowledgeBase.values());
    }
    // ─── Helpers ───────────────────────────────────────────────
    countTokens(messages) {
        if (this.config.tokenCounter) {
            return messages.reduce((sum, m) => sum + this.config.tokenCounter(m.content), 0);
        }
        // Default: estimate ~4 chars per token
        return messages.reduce((sum, m) => sum + Math.ceil((m.content?.length || 0) / 4), 0);
    }
    extractTopics(messages) {
        // Simple keyword extraction
        const allContent = messages.map(m => m.content).join(' ');
        // Strip punctuation and split into words
        const words = allContent.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
        const wordCounts = new Map();
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'and', 'or', 'but', 'not', 'so', 'very', 'just', 'this', 'that', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'how', 'been', 'being', 'its', 'our', 'your']);
        for (const word of words) {
            if (word.length > 3 && !stopWords.has(word) && !/^\d+$/.test(word)) {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            }
        }
        return Array.from(wordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }
    countRoles(messages) {
        const counts = {};
        for (const m of messages) {
            counts[m.role] = (counts[m.role] || 0) + 1;
        }
        return Object.entries(counts).map(([r, c]) => `${r}:${c}`).join(', ');
    }
    createEmptySummary() {
        return {
            id: (0, uuid_1.v4)(),
            originalMessageCount: 0,
            summary: 'No compression needed',
            tokensSaved: 0,
            timeRange: { start: new Date(), end: new Date() },
            preservedTopics: [],
            timestamp: new Date(),
        };
    }
    loadPersistedData() {
        if (!this.config.persistencePath)
            return;
        try {
            if (fs.existsSync(this.config.persistencePath)) {
                const data = JSON.parse(fs.readFileSync(this.config.persistencePath, 'utf-8'));
                if (data.anchors) {
                    for (const a of data.anchors) {
                        this.anchors.set(a.id, { ...a, createdAt: new Date(a.createdAt) });
                    }
                }
                if (data.knowledge) {
                    for (const k of data.knowledge) {
                        this.knowledgeBase.set(k.id, { ...k, createdAt: new Date(k.createdAt) });
                    }
                }
                if (data.compressedHistory) {
                    this.compressedHistory = data.compressedHistory.map((c) => ({
                        ...c,
                        timestamp: new Date(c.timestamp),
                    }));
                }
            }
        }
        catch {
            console.error('[CognitiveGovernor] Failed to load persisted data');
        }
    }
    savePersistedData() {
        if (!this.config.persistencePath)
            return;
        try {
            const dir = require('path').dirname(this.config.persistencePath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.config.persistencePath, JSON.stringify({
                anchors: Array.from(this.anchors.values()),
                knowledge: Array.from(this.knowledgeBase.values()),
                compressedHistory: this.compressedHistory.slice(-50),
            }, null, 2));
        }
        catch {
            console.error('[CognitiveGovernor] Failed to save persisted data');
        }
    }
    /**
     * Stop and save
     */
    stop() {
        this.savePersistedData();
    }
}
exports.CognitiveGovernor = CognitiveGovernor;
//# sourceMappingURL=governor.js.map