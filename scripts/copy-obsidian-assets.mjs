#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");

const requiredFiles = [
	{
		source: "manifest.json",
		target: "manifest.json",
	},
];
const optionalFiles = [
	{
		source: "src/styles.css",
		target: "styles.css",
	},
];

fs.mkdirSync(distDir, { recursive: true });

for (const file of requiredFiles) {
	const source = path.join(projectRoot, file.source);
	const target = path.join(distDir, file.target);
	if (!fs.existsSync(source)) {
		console.error(`Error: missing required file ${source}`);
		process.exit(1);
	}
	fs.copyFileSync(source, target);
	console.log(`Copied ${file.source} -> dist/${file.target}`);
}

for (const file of optionalFiles) {
	const source = path.join(projectRoot, file.source);
	const target = path.join(distDir, file.target);
	if (!fs.existsSync(source)) {
		console.log(`Skipped ${file.source}: file not found at project root`);
		continue;
	}
	fs.copyFileSync(source, target);
	console.log(`Copied ${file.source} -> dist/${file.target}`);
}
