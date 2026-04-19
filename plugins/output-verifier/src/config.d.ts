/**
 * Output Verifier - Configuration Management
 */
import { OutputVerifierConfig } from './types';
export declare function getDefaultConfig(): OutputVerifierConfig;
export declare function loadConfig(overrides?: Partial<OutputVerifierConfig>): OutputVerifierConfig;
export { OutputVerifierConfig };
