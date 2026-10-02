import * as vscode from 'vscode';
import { lineUp } from './lineUp';
import { lineUpUsings } from './usings';
import { lineUpUsingsInFiles } from './lineUpFiles';
import { findProjectFiles, locate, readSolutionProjects } from './dotnet';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand('line-up.lineUpSelectedLines', lineUpSelectedLines),
		vscode.commands.registerCommand('line-up.lineUpUsingsInProject', lineUpUsingsInProject),
		vscode.commands.registerCommand('line-up.lineUpUsingsInSolution', lineUpUsingsInSolution),
		vscode.workspace.onWillSaveTextDocument(lineUpUsingsOnSave)
	);
}

export function deactivate() {}

function lineUpSelectedLines(editor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
	const { document } = editor;

	for (const selection of editor.selections) {
		const range = toFullLineRange(document, selection);
		if (range.start.line === range.end.line) {
			continue;
		}

		const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
		const lines = document.getText(range).split(/\r?\n/);
		edit.replace(range, lineUp(lines).join(eol));
	}
}

/**
 * Expands a selection to cover its lines completely. A selection that ends
 * at the very start of a line does not include that line.
 */
function toFullLineRange(document: vscode.TextDocument, selection: vscode.Selection): vscode.Range {
	const startLine = selection.start.line;
	let endLine = selection.end.line;

	if (endLine > startLine && selection.end.character === 0) {
		endLine--;
	}

	return new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
}

/** Lines up the using directives of a C# file when it is saved with unsaved changes. */
function lineUpUsingsOnSave(event: vscode.TextDocumentWillSaveEvent) {
	const { document } = event;
	const enabled = vscode.workspace.getConfiguration('lineUp', document).get<boolean>('usingsOnSave');

	if (!enabled || document.languageId !== 'csharp' || !document.isDirty
		|| event.reason !== vscode.TextDocumentSaveReason.Manual) {
		return;
	}

	const edits = lineUpUsings(document.getText().split(/\r?\n/))
		.map(({ line, text }) => vscode.TextEdit.replace(document.lineAt(line).range, text));

	event.waitUntil(Promise.resolve(edits));
}

async function lineUpUsingsInProject() {
	const project = await locate(['.csproj'], 'C# project');
	if (!project) {
		vscode.window.showWarningMessage('Line Up: No C# project found.');
		return;
	}

	await lineUpUsingsWithProgress(fileName(project), () => findProjectFiles(project));
}

async function lineUpUsingsInSolution() {
	const solution = await locate(['.sln', '.slnx'], 'solution');
	if (!solution) {
		vscode.window.showWarningMessage('Line Up: No solution found.');
		return;
	}

	await lineUpUsingsWithProgress(fileName(solution), async () => {
		const projects = await readSolutionProjects(solution);
		// A project listed in the solution but missing on disk is skipped.
		const files = await Promise.all(projects.map(project => findProjectFiles(project).catch(() => [])));
		return files.flat();
	});
}

async function lineUpUsingsWithProgress(name: string, findFiles: () => Promise<vscode.Uri[]>) {
	const { total, changed } = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Lining up using directives in ${name}...` },
		async () => {
			const files = await findFiles();
			return { total: files.length, changed: await lineUpUsingsInFiles(files) };
		}
	);

	vscode.window.showInformationMessage(`Line Up: Lined up using directives in ${changed} of ${total} C# files in ${name}.`);
}

function fileName(file: vscode.Uri): string {
	return file.path.split('/').pop() ?? file.path;
}
