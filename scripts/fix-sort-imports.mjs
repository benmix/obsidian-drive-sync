import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const SYNTAX_RANK = {
	none: 0,
	all: 1,
	multiple: 2,
	single: 3,
};

function compareIgnoreCase(left, right) {
	const lowerLeft = left.toLowerCase();
	const lowerRight = right.toLowerCase();
	if (lowerLeft < lowerRight) {
		return -1;
	}
	if (lowerLeft > lowerRight) {
		return 1;
	}
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}
	return 0;
}

function getSpecifierSortKey(element) {
	return element.name.text;
}

function formatSpecifier(element) {
	const typePrefix = element.isTypeOnly ? "type " : "";
	const importedName = element.propertyName?.text;
	if (importedName && importedName !== element.name.text) {
		return `${typePrefix}${importedName} as ${element.name.text}`;
	}
	return `${typePrefix}${element.name.text}`;
}

function classifySyntax(clause) {
	if (!clause) {
		return "none";
	}
	const namedBindings = clause.namedBindings;
	if (namedBindings && ts.isNamespaceImport(namedBindings)) {
		return "all";
	}
	const namedCount =
		namedBindings && ts.isNamedImports(namedBindings) ? namedBindings.elements.length : 0;
	const totalImported = (clause.name ? 1 : 0) + namedCount;
	return totalImported > 1 ? "multiple" : "single";
}

function buildImportDescriptor(declaration, index) {
	const moduleSpecifierNode = declaration.moduleSpecifier;
	if (!ts.isStringLiteral(moduleSpecifierNode)) {
		return null;
	}
	const moduleSpecifier = moduleSpecifierNode.text;
	const clause = declaration.importClause;
	const syntax = classifySyntax(clause);
	const rank = SYNTAX_RANK[syntax];

	if (!clause) {
		return {
			index,
			rank,
			sortKey: moduleSpecifier,
			moduleSpecifier,
			rendered: `import "${moduleSpecifier}";`,
		};
	}

	const importPrefix = clause.isTypeOnly ? "import type " : "import ";
	const defaultName = clause.name?.text;
	const namedBindings = clause.namedBindings;

	if (namedBindings && ts.isNamespaceImport(namedBindings)) {
		const namespaceText = `* as ${namedBindings.name.text}`;
		const clauseText = defaultName ? `${defaultName}, ${namespaceText}` : namespaceText;
		return {
			index,
			rank,
			sortKey: defaultName ?? namedBindings.name.text,
			moduleSpecifier,
			rendered: `${importPrefix}${clauseText} from "${moduleSpecifier}";`,
		};
	}

	const elements =
		namedBindings && ts.isNamedImports(namedBindings) ? [...namedBindings.elements] : [];
	elements.sort((left, right) => {
		const keyResult = compareIgnoreCase(getSpecifierSortKey(left), getSpecifierSortKey(right));
		if (keyResult !== 0) {
			return keyResult;
		}
		return compareIgnoreCase(left.name.text, right.name.text);
	});

	const parts = [];
	if (defaultName) {
		parts.push(defaultName);
	}
	if (elements.length > 0) {
		parts.push(`{ ${elements.map(formatSpecifier).join(", ")} }`);
	}

	const sortKey =
		defaultName ?? getSpecifierSortKey(elements[0] ?? { name: { text: moduleSpecifier } });
	return {
		index,
		rank,
		sortKey,
		moduleSpecifier,
		rendered: `${importPrefix}${parts.join(", ")} from "${moduleSpecifier}";`,
	};
}

function collectTopImports(sourceFile) {
	const imports = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement)) {
			break;
		}
		imports.push(statement);
	}
	return imports;
}

function hasCommentInImportBlock(blockText) {
	return /(^|\n)\s*\/\//.test(blockText) || /\/\*/.test(blockText);
}

function reorderImportsInSource(sourceText, filePath) {
	const sourceFile = ts.createSourceFile(
		filePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const imports = collectTopImports(sourceFile);
	if (imports.length === 0) {
		return { changed: false, content: sourceText, skipped: false };
	}

	const blockStart = imports[0].getStart(sourceFile);
	const blockEnd = imports[imports.length - 1].getEnd();
	const oldBlock = sourceText.slice(blockStart, blockEnd);
	if (hasCommentInImportBlock(oldBlock)) {
		return { changed: false, content: sourceText, skipped: true };
	}

	const descriptors = imports
		.map((declaration, index) => buildImportDescriptor(declaration, index))
		.filter((entry) => entry !== null);
	if (descriptors.length !== imports.length) {
		return { changed: false, content: sourceText, skipped: true };
	}

	descriptors.sort((left, right) => {
		if (left.rank !== right.rank) {
			return left.rank - right.rank;
		}
		const keyResult = compareIgnoreCase(left.sortKey, right.sortKey);
		if (keyResult !== 0) {
			return keyResult;
		}
		const moduleResult = compareIgnoreCase(left.moduleSpecifier, right.moduleSpecifier);
		if (moduleResult !== 0) {
			return moduleResult;
		}
		return left.index - right.index;
	});

	const newBlock = descriptors.map((entry) => entry.rendered).join("\n");
	if (newBlock === oldBlock) {
		return { changed: false, content: sourceText, skipped: false };
	}

	const updated = `${sourceText.slice(0, blockStart)}${newBlock}${sourceText.slice(blockEnd)}`;
	return { changed: true, content: updated, skipped: false };
}

function resolveTargetFiles(targets) {
	if (targets.length === 0) {
		targets = ["src", "scripts"];
	}
	const files = execFileSync("rg", ["--files", ...targets], {
		encoding: "utf8",
	})
		.split("\n")
		.map((value) => value.trim())
		.filter(Boolean)
		.filter((value) =>
			[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].some((suffix) => value.endsWith(suffix)),
		)
		.filter((value) => !value.includes("/node_modules/"));
	return [...new Set(files)];
}

async function main() {
	const targets = process.argv.slice(2);
	const files = resolveTargetFiles(targets);
	let changedCount = 0;
	let skippedCount = 0;

	for (const relativePath of files) {
		const absolutePath = path.resolve(relativePath);
		const sourceText = await fs.readFile(absolutePath, "utf8");
		const result = reorderImportsInSource(sourceText, absolutePath);
		if (result.skipped) {
			skippedCount += 1;
			continue;
		}
		if (result.changed) {
			await fs.writeFile(absolutePath, result.content, "utf8");
			changedCount += 1;
		}
	}

	console.log(
		`sorted imports in ${changedCount} files` +
			(skippedCount > 0 ? `, skipped ${skippedCount} files with import comments` : ""),
	);
}

await main();
