import { lineUp } from './lineUp';

/**
 * Matches C# using directives such as `using System;`, `using static System.Math;`,
 * `global using System.Linq;` and `using Json = System.Text.Json;`, but not
 * using statements or declarations like `using (var x = ...)` or `using var x = ...;`.
 */
const usingDirective = /^\s*(global\s+)?using\s+(static\s+)?[\w.]+(\s*=\s*[\w.<>,\s]+)?\s*;\s*$/;

export interface LineBlock {
	/** Index of the block's first line. */
	start: number;
	lines: string[];
}

export interface LineChange {
	/** Index of the line to replace. */
	line: number;
	text: string;
}

/** Finds each run of consecutive using directives. Blank lines or other code end a run. */
export function findUsingBlocks(lines: readonly string[]): LineBlock[] {
	const blocks: LineBlock[] = [];
	let current: LineBlock | undefined;

	lines.forEach((line, index) => {
		if (!usingDirective.test(line)) {
			current = undefined;
		} else if (current) {
			current.lines.push(line);
		} else {
			current = { start: index, lines: [line] };
			blocks.push(current);
		}
	});

	return blocks.filter(block => block.lines.length > 1);
}

/** Lines up each run of using directives, returning only the lines that change. */
export function lineUpUsings(lines: readonly string[]): LineChange[] {
	const changes: LineChange[] = [];

	for (const block of findUsingBlocks(lines)) {
		lineUp(block.lines).forEach((text, offset) => {
			if (text !== block.lines[offset]) {
				changes.push({ line: block.start + offset, text });
			}
		});
	}

	return changes;
}
