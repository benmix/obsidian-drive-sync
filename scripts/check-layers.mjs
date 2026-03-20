#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const repoRoot = process.cwd();
const srcRoot = path.resolve(repoRoot, "src");
const testsRoot = path.resolve(repoRoot, "tests");
const contractsRoot = path.resolve(srcRoot, "types");
const aliasRoots = new Map([
	["@commands", path.resolve(srcRoot, "commands")],
	["@config", path.resolve(srcRoot, "internal-config.ts")],
	["@contracts", contractsRoot],
	["@data", path.resolve(srcRoot, "data")],
	["@errors", path.resolve(srcRoot, "errors")],
	["@filesystem", path.resolve(srcRoot, "filesystem")],
	["@i18n", path.resolve(srcRoot, "i18n")],
	["@provider", path.resolve(srcRoot, "provider")],
	["@runtime", path.resolve(srcRoot, "runtime")],
	["@sync", path.resolve(srcRoot, "sync")],
	["@tests", testsRoot],
	["@ui", path.resolve(srcRoot, "ui")],
]);

const contractAllowedDependencies = new Map([
	["plugin", new Set(["plugin", "provider", "sync"])],
	["sync", new Set(["sync", "data", "filesystem"])],
	["provider", new Set(["provider", "filesystem"])],
	["provider/proton", new Set(["provider/proton", "provider", "filesystem"])],
	["filesystem", new Set(["filesystem"])],
	["data", new Set(["data", "filesystem", "plugin"])],
	["i18n", new Set(["i18n"])],
	["runtime", new Set(["runtime"])],
	["ui", new Set(["ui"])],
]);

const implementationAllowedDependencies = new Map([
	[
		"app",
		new Set([
			"app",
			"commands",
			"data",
			"errors",
			"filesystem",
			"i18n",
			"provider",
			"runtime",
			"sync",
			"ui",
			"config",
		]),
	],
	["commands", new Set(["commands", "runtime", "ui", "errors", "i18n", "config"])],
	["config", new Set(["config"])],
	["data", new Set(["data", "filesystem", "config"])],
	["errors", new Set(["errors", "config"])],
	["filesystem", new Set(["filesystem", "config"])],
	["i18n", new Set(["i18n", "config"])],
	[
		"provider",
		new Set([
			"provider",
			"provider/obsidian/root",
			"provider/proton-drive/root",
			"filesystem",
			"errors",
			"config",
		]),
	],
	[
		"provider/obsidian/root",
		new Set(["provider/obsidian/root", "provider/obsidian/fs", "provider/obsidian/watcher"]),
	],
	["provider/obsidian/fs", new Set(["provider/obsidian/fs", "filesystem", "errors"])],
	["provider/obsidian/watcher", new Set(["provider/obsidian/watcher", "filesystem"])],
	[
		"provider/proton-drive/root",
		new Set([
			"provider/proton-drive/root",
			"provider/proton-drive/auth",
			"provider/proton-drive/sdk",
			"provider/proton-drive/remote",
			"provider/proton-drive/shared",
			"errors",
		]),
	],
	[
		"provider/proton-drive/auth",
		new Set([
			"provider/proton-drive/auth",
			"provider/proton-drive/sdk",
			"provider/proton-drive/transport",
			"provider/proton-drive/crypto",
			"provider/proton-drive/shared",
			"errors",
		]),
	],
	[
		"provider/proton-drive/sdk",
		new Set([
			"provider/proton-drive/sdk",
			"provider/proton-drive/transport",
			"provider/proton-drive/crypto",
			"provider/proton-drive/shared",
		]),
	],
	[
		"provider/proton-drive/remote",
		new Set([
			"provider/proton-drive/remote",
			"provider/proton-drive/shared",
			"errors",
			"filesystem",
		]),
	],
	["provider/proton-drive/transport", new Set(["provider/proton-drive/transport"])],
	["provider/proton-drive/crypto", new Set(["provider/proton-drive/crypto"])],
	["provider/proton-drive/shared", new Set(["provider/proton-drive/shared"])],
	[
		"runtime",
		new Set(["runtime", "provider", "data", "filesystem", "sync", "errors", "i18n", "config"]),
	],
	["sync", new Set(["sync", "data", "filesystem", "errors", "config"])],
	["ui", new Set(["ui", "filesystem", "errors", "i18n", "config"])],
]);

const contractFiles = await listTypeScriptFiles(contractsRoot);
const implementationFiles = (await listTypeScriptFiles(srcRoot)).filter(
	(file) => !isWithinRoot(file, contractsRoot),
);

const errors = [
	...(await validateScope({
		name: "contracts",
		files: contractFiles,
		classifyFile: classifyContractFile,
		allowedDependencies: contractAllowedDependencies,
		allowImportTarget: (targetPath) => isWithinRoot(targetPath, contractsRoot),
		buildDisallowedTargetMessage: (sourceFile, targetPath) =>
			`${formatFile(sourceFile)} imports implementation file ${formatFile(targetPath)}. Contracts may only depend on other contracts or external packages.`,
		buildCycleMessage: (cycle) =>
			`Contracts cycle detected: ${cycle.map((file) => formatFile(file)).join(" -> ")}`,
	})),
	...(await validateScope({
		name: "implementation",
		files: implementationFiles,
		classifyFile: classifyImplementationFile,
		allowedDependencies: implementationAllowedDependencies,
		allowImportTarget: (targetPath) =>
			isWithinRoot(targetPath, contractsRoot) || isWithinRoot(targetPath, srcRoot),
		buildDisallowedTargetMessage: (sourceFile, targetPath) => {
			if (!isWithinRoot(targetPath, srcRoot)) {
				return `${formatFile(sourceFile)} imports ${formatFile(targetPath)} outside src/. Implementation files may only depend on src/ modules or external packages.`;
			}
			return `${formatFile(sourceFile)} imports unmanaged source file ${formatFile(targetPath)}. Add it to the implementation layer map before using it.`;
		},
		shouldTrackDependency: (targetPath) => !isWithinRoot(targetPath, contractsRoot),
		buildCycleMessage: (cycle) =>
			`Implementation cycle detected: ${cycle.map((file) => formatFile(file)).join(" -> ")}`,
	})),
];

if (errors.length > 0) {
	console.error("Source layer dependency check failed.\n");
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log("Source layer dependency check passed.");

async function validateScope({
	name,
	files,
	classifyFile,
	allowedDependencies,
	allowImportTarget,
	buildDisallowedTargetMessage,
	shouldTrackDependency = () => true,
	buildCycleMessage,
}) {
	const scopeErrors = [];
	const fileSet = new Set(files);
	const graph = new Map(files.map((file) => [file, []]));

	for (const file of files) {
		const layer = classifyFile(file);
		if (!layer) {
			scopeErrors.push(
				`${formatFile(file)} is not assigned to a ${name} layer. Update ${path.relative(repoRoot, path.resolve(repoRoot, "scripts/check-contracts.mjs"))} before adding this file.`,
			);
			continue;
		}

		if (!allowedDependencies.has(layer)) {
			scopeErrors.push(
				`${formatFile(file)} resolves to unknown ${name} layer "${layer}". Define its allowed dependencies before using it.`,
			);
			continue;
		}

		const source = await fs.readFile(file, "utf8");
		const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

		for (const statement of sourceFile.statements) {
			if (
				ts.isExportDeclaration(statement) &&
				statement.moduleSpecifier &&
				ts.isStringLiteral(statement.moduleSpecifier)
			) {
				scopeErrors.push(
					`${formatFile(file)} uses re-export "${statement.moduleSpecifier.text}". Re-exports are not allowed.`,
				);
				continue;
			}

			if (
				!ts.isImportDeclaration(statement) ||
				!ts.isStringLiteral(statement.moduleSpecifier)
			) {
				continue;
			}

			const specifier = statement.moduleSpecifier.text;
			if (!specifier.startsWith(".") && !isSupportedAliasSpecifier(specifier)) {
				continue;
			}

			const resolved = await resolveImport(file, specifier);
			if (!resolved) {
				scopeErrors.push(
					`${formatFile(file)} imports "${specifier}" but the target could not be resolved.`,
				);
				continue;
			}

			if (!allowImportTarget(resolved)) {
				scopeErrors.push(buildDisallowedTargetMessage(file, resolved));
				continue;
			}

			if (!fileSet.has(resolved)) {
				if (!shouldTrackDependency(resolved)) {
					continue;
				}
				scopeErrors.push(buildDisallowedTargetMessage(file, resolved));
				continue;
			}

			if (!shouldTrackDependency(resolved)) {
				continue;
			}

			graph.get(file)?.push(resolved);

			const targetLayer = classifyFile(resolved);
			if (!targetLayer) {
				scopeErrors.push(
					`${formatFile(resolved)} is not assigned to a ${name} layer. Update scripts/check-contracts.mjs before importing it.`,
				);
				continue;
			}

			const allowedTargets = allowedDependencies.get(layer);
			if (!allowedTargets?.has(targetLayer)) {
				scopeErrors.push(
					`${formatFile(file)} (${layer}) must not depend on ${formatFile(resolved)} (${targetLayer}).`,
				);
			}
		}
	}

	for (const cycle of detectCycles(graph)) {
		scopeErrors.push(buildCycleMessage(cycle));
	}

	return scopeErrors;
}

async function listTypeScriptFiles(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				return await listTypeScriptFiles(fullPath);
			}
			return entry.isFile() && fullPath.endsWith(".ts") ? [fullPath] : [];
		}),
	);
	return files.flat().sort();
}

async function resolveImport(fromFile, specifier) {
	const aliasedRoot = [...aliasRoots.entries()].find(
		([alias]) => specifier === alias || specifier.startsWith(`${alias}/`),
	);
	const suffix = aliasedRoot ? specifier.slice(aliasedRoot[0].length + 1) : "";
	const basePath = aliasedRoot
		? path.resolve(aliasedRoot[1], suffix)
		: path.resolve(path.dirname(fromFile), specifier);
	const candidates = [basePath, `${basePath}.ts`, path.join(basePath, "index.ts")];
	for (const candidate of candidates) {
		if (await isFile(candidate)) {
			return path.resolve(candidate);
		}
	}
	return null;
}

function isSupportedAliasSpecifier(specifier) {
	return [...aliasRoots.keys()].some(
		(alias) => specifier === alias || specifier.startsWith(`${alias}/`),
	);
}

async function isFile(targetPath) {
	try {
		const stat = await fs.stat(targetPath);
		return stat.isFile();
	} catch {
		return false;
	}
}

function classifyContractFile(file) {
	const relativePath = toPosix(path.relative(contractsRoot, file));
	if (relativePath === "i18n.ts") {
		return "i18n";
	}
	const [topLevel, secondLevel] = relativePath.split("/");
	if (topLevel === "provider" && secondLevel === "proton") {
		return "provider/proton";
	}
	return topLevel;
}

function classifyImplementationFile(file) {
	const relativePath = toPosix(path.relative(srcRoot, file));
	const segments = relativePath.split("/");

	const protonDriveLayer = classifyProtonDriveImplementationFile(relativePath);
	if (protonDriveLayer) {
		return protonDriveLayer;
	}

	const obsidianLayer = classifyObsidianImplementationFile(relativePath);
	if (obsidianLayer) {
		return obsidianLayer;
	}

	if (segments.length === 1) {
		if (relativePath === "main.ts" || relativePath === "settings.ts") {
			return "app";
		}
		if (relativePath === "internal-config.ts") {
			return "config";
		}
		return null;
	}

	const [topLevel] = segments;
	if (!implementationAllowedDependencies.has(topLevel)) {
		return null;
	}
	return topLevel;
}

function classifyProtonDriveImplementationFile(relativePath) {
	const protonDrivePrefix = "provider/providers/proton-drive/";
	if (!relativePath.startsWith(protonDrivePrefix)) {
		return null;
	}

	const protonDrivePath = relativePath.slice(protonDrivePrefix.length);
	if (protonDrivePath === "provider.ts") {
		return "provider/proton-drive/root";
	}
	if (protonDrivePath === "logger.ts") {
		return "provider/proton-drive/shared";
	}

	const [topLevel] = protonDrivePath.split("/");
	switch (topLevel) {
		case "auth":
			return "provider/proton-drive/auth";
		case "sdk":
			return "provider/proton-drive/sdk";
		case "remote":
			return "provider/proton-drive/remote";
		case "transport":
			return "provider/proton-drive/transport";
		case "crypto":
			return "provider/proton-drive/crypto";
		default:
			return "provider/proton-drive/root";
	}
}

function classifyObsidianImplementationFile(relativePath) {
	const obsidianPrefix = "provider/providers/obsidian/";
	if (!relativePath.startsWith(obsidianPrefix)) {
		return null;
	}

	const obsidianPath = relativePath.slice(obsidianPrefix.length);
	switch (obsidianPath) {
		case "provider.ts":
			return "provider/obsidian/root";
		case "file-system.ts":
			return "provider/obsidian/fs";
		case "watcher.ts":
			return "provider/obsidian/watcher";
		default:
			return "provider/obsidian/root";
	}
}

function detectCycles(graphMap) {
	const state = new Map();
	const stack = [];
	const cycles = [];
	const seenCycles = new Set();

	for (const file of graphMap.keys()) {
		visit(file);
	}

	return cycles;

	function visit(file) {
		const currentState = state.get(file) ?? 0;
		if (currentState === 1) {
			const startIndex = stack.indexOf(file);
			const cycle = [...stack.slice(startIndex), file];
			const key = cycle.join("->");
			if (!seenCycles.has(key)) {
				seenCycles.add(key);
				cycles.push(cycle);
			}
			return;
		}
		if (currentState === 2) {
			return;
		}

		state.set(file, 1);
		stack.push(file);
		for (const dependency of graphMap.get(file) ?? []) {
			visit(dependency);
		}
		stack.pop();
		state.set(file, 2);
	}
}

function isWithinRoot(targetPath, rootPath) {
	const relativePath = path.relative(rootPath, targetPath);
	return (
		relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && relativePath !== ""
	);
}

function formatFile(file) {
	return toPosix(path.relative(repoRoot, file));
}

function toPosix(filePath) {
	return filePath.split(path.sep).join("/");
}
