import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { lineUp } from '../lineUp';
import { findUsingBlocks } from '../usings';
import { findProjectFiles, readSolutionProjects } from '../dotnet';

suite('lineUp', () => {
	test('orders lines from shortest to longest', () => {
		assert.deepStrictEqual(
			lineUp(['using System.Threading.Tasks;', 'using System;', 'using System.Linq;']),
			['using System;', 'using System.Linq;', 'using System.Threading.Tasks;']
		);
	});

	test('keeps the original order of equal-length lines', () => {
		assert.deepStrictEqual(lineUp(['bbb', 'a', 'ccc', 'aaa']), ['a', 'bbb', 'ccc', 'aaa']);
	});

	test('ignores surrounding whitespace when measuring length', () => {
		assert.deepStrictEqual(lineUp(['    abc', 'abcd  ']), ['    abc', 'abcd  ']);
		assert.deepStrictEqual(lineUp(['abcd', '        ab']), ['        ab', 'abcd']);
	});
});

suite('line-up.lineUp command', () => {
	async function runOn(content: string, selection: vscode.Selection): Promise<string> {
		const document = await vscode.workspace.openTextDocument({ content });
		const editor = await vscode.window.showTextDocument(document);
		editor.selection = selection;
		await vscode.commands.executeCommand('line-up.lineUpSelectedLines');
		return document.getText();
	}

	test('rearranges the selected lines', async () => {
		const text = await runOn('first\nccc\na\nbb\nlast', new vscode.Selection(1, 1, 3, 1));
		assert.strictEqual(text, 'first\na\nbb\nccc\nlast');
	});

	test('excludes a line the selection only touches at column 0', async () => {
		const text = await runOn('ccc\na\nbb\nz', new vscode.Selection(0, 0, 3, 0));
		assert.strictEqual(text, 'a\nbb\nccc\nz');
	});
});

suite('findUsingBlocks', () => {
	test('finds each run of using directives', () => {
		const blocks = findUsingBlocks([
			'using System.Linq;',
			'using System;',
			'',
			'global using static System.Math;',
			'using Json = System.Text.Json;',
			'namespace App;',
		]);
		assert.deepStrictEqual(blocks, [
			{ start: 0, lines: ['using System.Linq;', 'using System;'] },
			{ start: 3, lines: ['global using static System.Math;', 'using Json = System.Text.Json;'] },
		]);
	});

	test('ignores using statements and declarations', () => {
		assert.deepStrictEqual(findUsingBlocks([
			'using var stream = File.OpenRead(path);',
			'using (var reader = new StreamReader(stream))',
			'using var writer = new StreamWriter(stream);',
		]), []);
	});
});

suite('lining up usings on save', () => {
	test('rearranges the using directives of a C# file', async () => {
		const file = path.join(os.tmpdir(), `line-up-${Date.now()}.cs`);
		fs.writeFileSync(file, 'using System.Linq;\nusing System;\n\nclass A { }\n');

		const document = await vscode.workspace.openTextDocument(file);
		const editor = await vscode.window.showTextDocument(document);
		await editor.edit(edit => edit.insert(new vscode.Position(3, 10), ' '));
		await document.save();

		assert.strictEqual(fs.readFileSync(file, 'utf8'), 'using System;\nusing System.Linq;\n\nclass A {  }\n');
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		fs.unlinkSync(file);
	});
});

suite('lining up usings in projects and solutions', () => {
	const unsorted = 'using System.Linq;\nusing System;\n\nclass A { }\n';
	const sorted = 'using System;\nusing System.Linq;\n\nclass A { }\n';
	let root: string;

	function write(relative: string, content: string) {
		const file = path.join(root, relative);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, content);
	}

	function read(relative: string): string {
		return fs.readFileSync(path.join(root, relative), 'utf8');
	}

	setup(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'line-up-'));
		write('App.sln', [
			'Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "App", "src\\App\\App.csproj", "{1}"',
			'EndProject',
			'Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Lib", "src\\Lib\\Lib.csproj", "{2}"',
			'EndProject',
		].join('\r\n'));
		write('src/App/App.csproj', '<Project />');
		write('src/App/Program.cs', unsorted);
		write('src/App/Models/Model.cs', unsorted);
		write('src/App/obj/Generated.cs', unsorted);
		write('src/App/Tools/Tools.csproj', '<Project />');
		write('src/App/Tools/Tool.cs', unsorted);
		write('src/Lib/Lib.csproj', '<Project />');
		write('src/Lib/Library.cs', unsorted);
	});

	teardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		fs.rmSync(root, { recursive: true, force: true });
	});

	async function runFrom(relative: string, command: string) {
		await vscode.window.showTextDocument(vscode.Uri.file(path.join(root, relative)));
		await vscode.commands.executeCommand(command);
	}

	test('reads the C# projects of a solution', async () => {
		const projects = await readSolutionProjects(vscode.Uri.file(path.join(root, 'App.sln')));
		assert.deepStrictEqual(projects.map(project => project.fsPath), [
			path.join(root, 'src', 'App', 'App.csproj'),
			path.join(root, 'src', 'Lib', 'Lib.csproj'),
		]);
	});

	test('reads the C# projects of an .slnx solution', async () => {
		write('App.slnx', '<Solution>\n  <Project Path="src/Lib/Lib.csproj" />\n</Solution>');
		const projects = await readSolutionProjects(vscode.Uri.file(path.join(root, 'App.slnx')));
		assert.deepStrictEqual(projects.map(project => project.fsPath), [path.join(root, 'src', 'Lib', 'Lib.csproj')]);
	});

	test('finds project files, skipping build output and nested projects', async () => {
		const files = await findProjectFiles(vscode.Uri.file(path.join(root, 'src', 'App', 'App.csproj')));
		assert.deepStrictEqual(files.map(file => path.relative(root, file.fsPath)).sort(), [
			path.join('src', 'App', 'Models', 'Model.cs'),
			path.join('src', 'App', 'Program.cs'),
		]);
	});

	test('lines up the current project', async () => {
		await runFrom('src/App/Program.cs', 'line-up.lineUpUsingsInProject');
		assert.strictEqual(read('src/App/Program.cs'), sorted);
		assert.strictEqual(read('src/App/Models/Model.cs'), sorted);
		assert.strictEqual(read('src/App/Tools/Tool.cs'), unsorted);
		assert.strictEqual(read('src/Lib/Library.cs'), unsorted);
	});

	test('lines up every project in the solution', async () => {
		await runFrom('src/Lib/Library.cs', 'line-up.lineUpUsingsInSolution');
		assert.strictEqual(read('src/App/Program.cs'), sorted);
		assert.strictEqual(read('src/Lib/Library.cs'), sorted);
		assert.strictEqual(read('src/App/obj/Generated.cs'), unsorted);
	});

	test('keeps byte order marks and CRLF line endings', async () => {
		write('src/Lib/Windows.cs', '﻿' + unsorted.replace(/\n/g, '\r\n'));
		await runFrom('src/Lib/Library.cs', 'line-up.lineUpUsingsInProject');
		assert.strictEqual(read('src/Lib/Windows.cs'), '﻿' + sorted.replace(/\n/g, '\r\n'));
	});
});
