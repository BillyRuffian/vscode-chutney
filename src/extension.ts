import { exec } from 'child_process';
import * as vscode from 'vscode';
import { satisfies } from 'semver';


import {
	OutputChannel,
	window,
	workspace
} from 'vscode';

import {
	Executable,
	LanguageClient,
	LanguageClientOptions,
	RevealOutputChannelOn,
} from "vscode-languageclient/node";

class ExecError extends Error {
	command: string;
	options: object;
	code: number | undefined;
	stdout: string;
	stderr: string;

	constructor(message: string, command: string, options: object, code: number | undefined, stdout: string, stderr: string) {
		super(message);
		this.command = command;
		this.options = options;
		this.code = code;
		this.stdout = stdout;
		this.stderr = stderr;
	}

	log(): void {
		log(`Command \`${this.command}\` failed with exit code ${this.code ?? '?'} (exec options: ${JSON.stringify(this.options)})`);
		if (this.stdout.length > 0) {
			log(`stdout:\n${this.stdout}`);
		}
		if (this.stderr.length > 0) {
			log(`stderr:\n${this.stderr}`);
		}
	}
}

let languageClient: LanguageClient | null;
let outputChannel: OutputChannel | undefined;


export enum BundleStatus {
	valid = 0,
	missing = 1,
	errored = 2
}

export enum ChutneyBundleStatus {
	included = 0,
	excluded = 1,
	errored = 2
}

const promiseExec = async function (command: string, options = { cwd: getCwd() }): Promise<{ stdout: string, stderr: string }> {
	return await new Promise((resolve, reject) => {
		exec(command, options, (error, stdout, stderr) => {
			stdout = stdout.toString().trim();
			stderr = stderr.toString().trim();
			if (error !== null) {
				reject(new ExecError(error.message, command, options, error.code, stdout, stderr));
			} else {
				resolve({ stdout, stderr });
			}
		});
	});
};

function getCwd(): string {
	return workspace.workspaceFolders?.[0]?.uri?.fsPath ?? process.cwd();
}

function log(s: string): void {
	outputChannel?.appendLine(`[client] ${s}`);
}

async function displayError(message: string, actions: string[]): Promise<void> {
	const action = await window.showErrorMessage(message, ...actions);
	switch (action) {

		case 'Show Output':
			outputChannel?.show();
			break;

		default:
			if (action !== null) {
				log(`Unknown action: ${action}`);
			}
	}
}

function buildLanguageClientOptions(): LanguageClientOptions {
	return {
		documentSelector: [
			{ scheme: 'file', pattern: '**/*.feature' }
		],
		diagnosticCollectionName: 'chutney',
		initializationFailedHandler: (error) => {
			log(`Language server initialization failed: ${String(error)}`);
			return false;
		},
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		outputChannel,
		synchronize: {
			fileEvents: [
				workspace.createFileSystemWatcher('**/.chutney.yml'),
				workspace.createFileSystemWatcher('**/chutney.yml')
			]
		}
	};
}

async function isInBundle(): Promise<ChutneyBundleStatus> {
	try {
		await promiseExec('bundle show chutney', { cwd: getCwd() });
		return ChutneyBundleStatus.included;
	} catch (e) {
		if (!(e instanceof ExecError)) {return ChutneyBundleStatus.errored;}

		if (e.stderr.startsWith('Could not locate Gemfile') || e.stderr === 'Could not find gem \'chutney\'.') {
			return ChutneyBundleStatus.excluded;
		} else {
			e.log();
			log('Failed to invoke Bundler in the current workspace.');		
			return ChutneyBundleStatus.excluded;
		}
	}
}

async function getCommand(): Promise<string> {
	if (await isInBundle() === ChutneyBundleStatus.included) {
		console.log('Bundled version of chutney detected');
		return 'bundle exec chutney-lsp';
	} else {
		console.log('System chutney fallback');
		return 'chutney-lsp';
	}
}

const requiredGemVersion = '>= 3.8.1';
async function supportedVersionOfChutney(command: string): Promise<boolean> {
  console.log('checking chutney version');
	try {
    const { stdout } = await promiseExec(`${command} -v`);
    // const { stdout } = await promiseExec(`chutney -v`);
		console.log( stdout);
    const version = stdout.trim();
    if (satisfies(version, requiredGemVersion)) {
			console.log('version ok');
      return true;
    } else {
      log('Disabling because the extension does not support this version of the chutney gem.');
      log(`  Version reported by \`${command} -v\`: ${version} (${requiredGemVersion} required)`);
      await displayError(`Unsupported Chutney version: ${version} (${requiredGemVersion} required)`, ['Show Output']);
      return false;
    }
  } catch (e) {
    if (e instanceof ExecError) {e.log();}
    log('Failed to verify the version of chutney installed, proceeding anyway...');
    return true;
  }
}

async function buildExecutable(): Promise<Executable | undefined> {
	const command = await getCommand();
	if (command === null) {
		await displayError('Could not find chutney-lsp executable', ['Show Output']);
	} else if (await supportedVersionOfChutney(command)) {
		const [exe, ...args] = (command).split(' ');
		return {
      command: exe,
      args: args
    };
	}
}

async function createLanguageClient(): Promise<LanguageClient | null> {
	const run = await buildExecutable();
	if (typeof run !== 'undefined' && run !== null) {
		log(`Starting language server: ${run.command}`);
		return new LanguageClient('Chutney', { run, debug: run }, buildLanguageClientOptions());
	}
	else {
		return null;
	}
}

async function startLanguageServer(): Promise<void> {
	try {
		languageClient = await createLanguageClient();
		if (languageClient !== null) {
			await languageClient.start();
		}
	} catch (error) {
		languageClient = null;
		await displayError(
			'Failed to start Chutney Language Server',
			['Show Output']
		);
	}
}

export async function activate(context: vscode.ExtensionContext) {
	outputChannel = window.createOutputChannel('Chutney');
	context.subscriptions.push(outputChannel);

	await startLanguageServer();
	log('Started chutney lsp');
}

// This method is called when your extension is deactivated
export function deactivate() { }

