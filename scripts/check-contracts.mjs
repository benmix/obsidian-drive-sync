#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const contractsRoot = path.resolve(repoRoot, "src/contracts");

const allowedDependencies = new Map([
	["plugin", new Set(["plugin", "provider", "sync"])],
	["sync", new Set(["sync", "data", "filesystem"])],
	["provider", new Set(["provider", "filesystem"])],
	["provider/proton", new Set(["provider/proton", "provider", "filesystem"])],
	["filesystem", new Set(["filesystem"])],
	["data", new Set(["data", "filesystem", "plugin"])],
	["runtime", new Set(["runtime"])],
	["ui", new Set(["ui"])],
]);

const contractFiles = await listTypeScriptFiles(contractsRoot);
const contractFileSet = new Set(contractFiles);
const graph = new Map(contractFiles.map((file) => [file, []]));
const errors = [];

for (const file of contractFiles) {
	const source = await fs.readFile(file, "utf8");
	const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

	for (const statement of sourceFile.statements) {
		if (
			ts.isExportDeclaration(statement) &&
			statement.moduleSpecifier &&
			ts.isStringLiteral(statement.moduleSpecifier)
		) {
			errors.push(
				`${formatFile(file)} uses re-export "${statement.moduleSpecifier.text}". Re-exports are not allowed.`,
			);
			continue;
		}

		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			const specifier = statement.moduleSpecifier.text;
			if (!specifier.startsWith(".")) {
				continue;
			}

			const resolved = await resolveImport(file, specifier);
			if (!resolved) {
				errors.push(
					`${formatFile(file)} imports "${specifier}" but the target could not be resolved.`,
				);
				continue;
			}

			if (!isWithinRoot(resolved, contractsRoot)) {
				errors.push(
					`${formatFile(file)} imports implementation file ${formatFile(resolved)}. Contracts may only depend on other contracts or external packages.`,
				);
				continue;
			}

			if (!contractFileSet.has(resolved)) {
				errors.push(
					`${formatFile(file)} imports ${formatFile(resolved)}, which is outside the managed contracts file set.`,
				);
				continue;
			}

			graph.get(file)?.push(resolved);

			const fromLayer = classifyContractFile(file);
			const toLayer = classifyContractFile(resolved);
			const allowed = allowedDependencies.get(fromLayer);
			if (allowed && !allowed.has(toLayer)) {
				errors.push(
					`${formatFile(file)} (${fromLayer}) must not depend on ${formatFile(resolved)} (${toLayer}).`,
				);
			}
		}
	}
}

const cycles = detectCycles(graph);
for (const cycle of cycles) {
	errors.push(`Contracts cycle detected: ${cycle.map((file) => formatFile(file)).join(" -> ")}`);
}

if (errors.length > 0) {
	console.error("Contracts dependency check failed.\n");
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log("Contracts dependency check passed.");

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
	const basePath = path.resolve(path.dirname(fromFile), specifier);
	const candidates = [basePath, `${basePath}.ts`, path.join(basePath, "index.ts")];
	for (const candidate of candidates) {
		if (await pathExists(candidate)) {
			return path.resolve(candidate);
		}
	}
	return null;
}

async function pathExists(targetPath) {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

function classifyContractFile(file) {
	const relativePath = toPosix(path.relative(contractsRoot, file));
	const [topLevel, secondLevel] = relativePath.split("/");
	if (topLevel === "provider" && secondLevel === "proton") {
		return "provider/proton";
	}
	return topLevel;
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
