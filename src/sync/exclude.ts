import { normalizePath } from "./utils";

export type ExcludeRule = {
	pattern: string;
	regex: RegExp;
};

export type ExcludeValidation = {
	invalid: string[];
	valid: string[];
};

export function compileExcludeRules(patterns: string): ExcludeRule[] {
	const lines = splitPatterns(patterns);
	return lines
		.map((pattern) => normalizePath(pattern))
		.filter((pattern) => pattern.length > 0)
		.map((pattern) => ({
			pattern,
			regex: toRegExp(pattern),
		}));
}

export function validateExcludePatterns(patterns: string): ExcludeValidation {
	const lines = splitPatterns(patterns);
	const invalid: string[] = [];
	const valid: string[] = [];
	for (const line of lines) {
		const normalized = normalizePath(line);
		if (!normalized) {
			continue;
		}
		try {
			toRegExp(normalized);
			valid.push(line);
		} catch {
			invalid.push(line);
		}
	}
	return { invalid, valid };
}

export function previewExcludedPaths(paths: string[], rules: ExcludeRule[]): string[] {
	return paths
		.map((path) => normalizePath(path))
		.filter((path) => rules.some((rule) => rule.regex.test(path)));
}

export function isExcluded(path: string, rules: ExcludeRule[]): boolean {
	if (rules.length === 0) {
		return false;
	}
	const normalized = normalizePath(path);
	return rules.some((rule) => rule.regex.test(normalized));
}

function splitPatterns(patterns: string): string[] {
	return patterns
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function toRegExp(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	const normalized = escaped.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
	return new RegExp(`^${normalized}(?:$|/)`);
}
