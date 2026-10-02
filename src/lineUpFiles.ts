import * as vscode from 'vscode';
import { lineUpUsings } from './usings';

const utf8Bom = [0xef, 0xbb, 0xbf];

/** Lines up the using directives in each file, returning how many files changed. */
export async function lineUpUsingsInFiles(files: readonly vscode.Uri[]): Promise<number> {
	let changed = 0;
	for (const file of files) {
		if (await lineUpUsingsInFile(file)) {
			changed++;
		}
	}
	return changed;
}

/**
 * Files open in an editor are edited there, so the change can be undone,
 * and saved only if they had no unsaved changes before. Other files are
 * rewritten on disk directly.
 */
async function lineUpUsingsInFile(file: vscode.Uri): Promise<boolean> {
	const open = vscode.workspace.textDocuments.find(document => document.uri.toString() === file.toString());
	return open ? lineUpUsingsInDocument(open) : lineUpUsingsOnDisk(file);
}

async function lineUpUsingsInDocument(document: vscode.TextDocument): Promise<boolean> {
	const changes = lineUpUsings(document.getText().split(/\r?\n/));
	if (changes.length === 0) {
		return false;
	}

	const wasDirty = document.isDirty;
	const edit = new vscode.WorkspaceEdit();
	for (const { line, text } of changes) {
		edit.replace(document.uri, document.lineAt(line).range, text);
	}
	await vscode.workspace.applyEdit(edit);

	if (!wasDirty) {
		await document.save();
	}
	return true;
}

async function lineUpUsingsOnDisk(file: vscode.Uri): Promise<boolean> {
	const bytes = await vscode.workspace.fs.readFile(file);
	const hasBom = utf8Bom.every((byte, index) => bytes[index] === byte);

	// Splitting on \n alone keeps any \r on its line, so line endings survive untouched.
	const lines = new TextDecoder().decode(bytes).split('\n');
	const changes = lineUpUsings(lines);
	if (changes.length === 0) {
		return false;
	}

	for (const { line, text } of changes) {
		lines[line] = text;
	}

	const content = new TextEncoder().encode(lines.join('\n'));
	await vscode.workspace.fs.writeFile(file, hasBom ? new Uint8Array([...utf8Bom, ...content]) : content);
	return true;
}
