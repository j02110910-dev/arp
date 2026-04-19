/**
 * Cognitive Governor - Configuration
 */
import { CognitiveGovernorConfig } from './types';
export declare function getDefaultConfig(): CognitiveGovernorConfig;
export declare function loadConfig(overrides?: Partial<CognitiveGovernorConfig>): CognitiveGovernorConfig;
