import * as vscode from 'vscode';

/** Folders that never hold source files worth lining up. */
const ignoredFolders = new Set(['bin', 'obj', 'node_modules']);

/**
 * Finds the project or solution file to work on: the nearest one above the
 * active editor's file, otherwise one found in the workspace (asking the user
 * to choose when there are several).
 */
export async function locate(extensions: string[], label: string): Promise<vscode.Uri | undefined> {
	const active = vscode.window.activeTextEditor?.document.uri;
	if (active?.scheme === 'file') {
		const nearest = await findUpwards(active, extensions);
		if (nearest) {
			return nearest;
		}
	}

	const found = await vscode.workspace.findFiles(`**/*{${extensions.join(',')}}`, '**/{bin,obj,node_modules}/**');
	if (found.length <= 1) {
		return found[0];
	}

	const picked = await vscode.window.showQuickPick(
		found.map(uri => ({ label: vscode.workspace.asRelativePath(uri), uri })),
		{ placeHolder: `Select a ${label}` }
	);
	return picked?.uri;
}

async function findUpwards(start: vscode.Uri, extensions: string[]): Promise<vscode.Uri | undefined> {
	let dir = vscode.Uri.joinPath(start, '..');

	while (true) {
		const entries = await vscode.workspace.fs.readDirectory(dir);
		const match = entries.find(([name, type]) => type & vscode.FileType.File && hasExtension(name, extensions));
		if (match) {
			return vscode.Uri.joinPath(dir, match[0]);
		}

		const parent = vscode.Uri.joinPath(dir, '..');
		if (parent.path === dir.path) {
			return undefined;
		}
		dir = parent;
	}
}

/** Reads the C# projects listed in a .sln or .slnx solution file. */
export async function readSolutionProjects(solution: vscode.Uri): Promise<vscode.Uri[]> {
	const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(solution));
	const pattern = solution.path.endsWith('.slnx')
		? /<Project\s[^>]*Path="([^"]+\.csproj)"/g
		: /^Project\("[^"]*"\)\s*=\s*"[^"]*",\s*"([^"]+\.csproj)"/gm;

	const solutionDir = vscode.Uri.joinPath(solution, '..');
	return [...text.matchAll(pattern)].map(match => vscode.Uri.joinPath(solutionDir, match[1].replace(/\\/g, '/')));
}

/**
 * Lists the C# files that belong to a project: every .cs file under the
 * project's folder, skipping build output, hidden folders and nested projects.
 */
export async function findProjectFiles(project: vscode.Uri): Promise<vscode.Uri[]> {
	return findCSharpFiles(vscode.Uri.joinPath(project, '..'), true);
}

async function findCSharpFiles(dir: vscode.Uri, isProjectRoot: boolean): Promise<vscode.Uri[]> {
	const entries = await vscode.workspace.fs.readDirectory(dir);
	if (!isProjectRoot && entries.some(([name]) => hasExtension(name, ['.csproj']))) {
		return [];
	}

	const files: vscode.Uri[] = [];
	for (const [name, type] of entries) {
		const uri = vscode.Uri.joinPath(dir, name);
		if (type === vscode.FileType.Directory && !ignoredFolders.has(name) && !name.startsWith('.')) {
			files.push(...await findCSharpFiles(uri, false));
		} else if (type & vscode.FileType.File && hasExtension(name, ['.cs'])) {
			files.push(uri);
		}
	}
	return files;
}

function hasExtension(name: string, extensions: string[]): boolean {
	return extensions.some(extension => name.toLowerCase().endsWith(extension));
}
