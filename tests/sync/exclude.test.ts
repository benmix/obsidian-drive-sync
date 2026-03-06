import {
	compileExcludeRules,
	getBuiltInExcludePatterns,
	getBuiltInExcludeRules,
	isExcluded,
} from "../../src/sync/planner/exclude";
import { describe, expect, test } from "vitest";

describe("exclude rules", () => {
	test("compiles multiline patterns and trims whitespace", () => {
		const rules = compileExcludeRules(`
			.temp/
			drafts/*.md
			assets/**
		`);

		expect(rules.map((rule) => rule.pattern)).toEqual([".temp/", "drafts/*.md", "assets/**"]);
		expect(isExcluded(".temp/cache.json", rules)).toBe(true);
		expect(isExcluded("drafts/todo.md", rules)).toBe(true);
		expect(isExcluded("drafts/weekly/todo.md", rules)).toBe(false);
		expect(isExcluded("assets/images/icons/logo.svg", rules)).toBe(true);
	});

	test("matches normalized windows paths", () => {
		const rules = compileExcludeRules("drafts/*.md");
		expect(isExcluded("drafts\\note.md", rules)).toBe(true);
	});

	test("built-in patterns are stable and protected from mutation", () => {
		const patterns = getBuiltInExcludePatterns();
		patterns.push("custom");
		expect(getBuiltInExcludePatterns()).not.toContain("custom");

		const rules = getBuiltInExcludeRules();
		expect(isExcluded(".obsidian/cache/workspace", rules)).toBe(true);
		expect(isExcluded(".obsidian/workspace-mobile.json", rules)).toBe(true);
	});
});
