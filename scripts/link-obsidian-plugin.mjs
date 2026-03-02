#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const usage = `
Link this plugin build output into an Obsidian vault.

Usage:
  pnpm run link:obsidian -- --vault "/path/to/Vault"
  pnpm run link:obsidian -- "/path/to/Vault"
  OBSIDIAN_VAULT_PATH="/path/to/Vault" pnpm run link:obsidian

Options:
  --vault <path>   Obsidian vault root path
  -h, --help       Show this help message
`.trim();

function fail(message) {
	console.error(`Error: ${message}`);
	console.error("");
	console.error(usage);
	process.exit(1);
}

function expandHome(inputPath) {
	if (inputPath === "~") {
		return os.homedir();
	}
	if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
		return path.join(os.homedir(), inputPath.slice(2));
	}
	return inputPath;
}

function parseArgs(argv) {
	let vaultPath;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];

		if (arg === "-h" || arg === "--help") {
			console.log(usage);
			process.exit(0);
		}

		if (arg === "--vault") {
			const value = argv[i + 1];
			if (!value) {
				fail("Missing value for --vault");
			}
			vaultPath = value;
			i += 1;
			continue;
		}

		if (arg.startsWith("--vault=")) {
			vaultPath = arg.slice("--vault=".length);
			continue;
		}

		if (arg.startsWith("-")) {
			fail(`Unknown option: ${arg}`);
		}

		if (!vaultPath) {
			vaultPath = arg;
			continue;
		}

		fail(`Unexpected argument: ${arg}`);
	}

	return vaultPath;
}

function ensureFileSymlink(sourcePath, targetPath) {
	try {
		const current = fs.lstatSync(targetPath);
		if (current.isDirectory() && !current.isSymbolicLink()) {
			fail(`Refusing to replace directory: ${targetPath}`);
		}
		fs.rmSync(targetPath, { force: true, recursive: true });
	} catch (error) {
		if (error && error.code !== "ENOENT") {
			throw error;
		}
	}

	const linkType = process.platform === "win32" ? "file" : undefined;
	fs.symlinkSync(sourcePath, targetPath, linkType);
}

const inputVaultPath = parseArgs(process.argv.slice(2)) ?? process.env.OBSIDIAN_VAULT_PATH;
if (!inputVaultPath) {
	fail("Vault path is required. Pass --vault or set OBSIDIAN_VAULT_PATH.");
}

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const manifestPath = path.join(projectRoot, "manifest.json");
if (!fs.existsSync(manifestPath)) {
	fail(`manifest.json not found under ${projectRoot}`);
}

let manifest;
try {
	manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
	fail(
		`Failed to parse manifest.json: ${error instanceof Error ? error.message : String(error)}`,
	);
}

const pluginId = manifest?.id;
if (typeof pluginId !== "string" || pluginId.length === 0) {
	fail(`Invalid plugin id in manifest.json: ${JSON.stringify(pluginId)}`);
}

const vaultPath = path.resolve(expandHome(inputVaultPath));
const obsidianConfigPath = path.join(vaultPath, ".obsidian");
if (!fs.existsSync(obsidianConfigPath) || !fs.statSync(obsidianConfigPath).isDirectory()) {
	fail(`Cannot find ${obsidianConfigPath}. Provide the vault root path.`);
}

const pluginDir = path.join(obsidianConfigPath, "plugins", pluginId);
fs.mkdirSync(pluginDir, { recursive: true });

const linkJobs = [
	{
		source: path.join(distDir, "main.js"),
		target: path.join(pluginDir, "main.js"),
	},
	{
		source: path.join(distDir, "manifest.json"),
		target: path.join(pluginDir, "manifest.json"),
	},
	{
		source: path.join(distDir, "styles.css"),
		target: path.join(pluginDir, "styles.css"),
	},
];

for (const job of linkJobs) {
	ensureFileSymlink(job.source, job.target);
}

console.log(`Linked plugin "${pluginId}" into vault: ${vaultPath}`);
for (const job of linkJobs) {
	console.log(`- ${job.target} -> ${job.source}`);
}
console.log(
	"If dist artifacts do not exist yet, run `pnpm run build` or `pnpm run copy:assets` then `pnpm run dev`.",
);
