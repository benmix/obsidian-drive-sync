import { normalizePath } from "../../filesystem/path";

export type ExcludeRule = {
	pattern: string;
	regex: RegExp;
};

const BUILTIN_EXCLUDE_PATTERNS = [".obsidian/cache/", ".obsidian/workspace*.json"];
const BUILTIN_EXCLUDE_RULES = compileExcludeRules(BUILTIN_EXCLUDE_PATTERNS.join("\n"));

export function getBuiltInExcludePatterns(): string[] {
	return [...BUILTIN_EXCLUDE_PATTERNS];
}

export function getBuiltInExcludeRules(): ExcludeRule[] {
	return BUILTIN_EXCLUDE_RULES;
}

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
	const isDirectoryPattern = pattern.endsWith("/");
	const normalizedPattern = isDirectoryPattern ? pattern.slice(0, -1) : pattern;
	const escaped = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	const withGlobStarSentinel = escaped.replace(/\*\*/g, "__DOUBLE_STAR__");
	const withSingleStar = withGlobStarSentinel.replace(/\*/g, "[^/]*");
	const normalized = withSingleStar.split("__DOUBLE_STAR__").join(".*");
	if (isDirectoryPattern) {
		return new RegExp(`^${normalized}(?:$|/.*$)`);
	}
	return new RegExp(`^${normalized}(?:$|/)`);
}
