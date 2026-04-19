/**
 * Cognitive Governor - Memory & Context Management
 * Compresses long conversations, anchors critical instructions, stores knowledge
 */

export {
  CognitiveGovernorConfig,
  ConversationMessage,
  CompressedContext,
  Anchor,
  KnowledgeEntry,
  ContextHealth,
  KnowledgeQuery,
  CompressionStrategy,
} from './types';

export { loadConfig, getDefaultConfig } from './config';
export { CognitiveGovernor } from './governor';
