"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullFeatureFlagProvider = void 0;
/**
 * Default feature flag provider that returns false for all flags.
 */
class NullFeatureFlagProvider {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isEnabled(flagName, signal) {
        return Promise.resolve(false);
    }
}
exports.NullFeatureFlagProvider = NullFeatureFlagProvider;
//# sourceMappingURL=featureFlags.js.map