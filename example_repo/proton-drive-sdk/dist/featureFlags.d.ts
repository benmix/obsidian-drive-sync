import { FeatureFlagProvider } from './interface/featureFlags';
/**
 * Default feature flag provider that returns false for all flags.
 */
export declare class NullFeatureFlagProvider implements FeatureFlagProvider {
    isEnabled(flagName: string, signal?: AbortSignal): Promise<boolean>;
}
