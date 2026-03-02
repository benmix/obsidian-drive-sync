#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");

const requiredFiles = ["manifest.json"];
const optionalFiles = ["styles.css"];

fs.mkdirSync(distDir, { recursive: true });

for (const fileName of requiredFiles) {
	const source = path.join(projectRoot, fileName);
	const target = path.join(distDir, fileName);
	if (!fs.existsSync(source)) {
		console.error(`Error: missing required file ${source}`);
		process.exit(1);
	}
	fs.copyFileSync(source, target);
	console.log(`Copied ${fileName} -> dist/${fileName}`);
}

for (const fileName of optionalFiles) {
	const source = path.join(projectRoot, fileName);
	const target = path.join(distDir, fileName);
	if (!fs.existsSync(source)) {
		console.log(`Skipped ${fileName}: file not found at project root`);
		continue;
	}
	fs.copyFileSync(source, target);
	console.log(`Copied ${fileName} -> dist/${fileName}`);
}
