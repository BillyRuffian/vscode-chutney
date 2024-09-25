import * as vscode from 'vscode';
import * as path from "path";

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
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let languageClient: LanguageClient | null;
let outputChannel: OutputChannel | undefined;

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

async function buildExecutable(): Promise<Executable | null> {
	const command = await getCommand();
	if (command === null) {
		await displayError('Could not find chutney-lsp executable', ['Show Output']);
	} else if (await supportedVersionOfChutney(command)) {

	}
}

async function createLanguageClient(): Promise<LanguageClient | null> {
	const run = await buildExecutable();
	if (run !== null) {
		log('Starting language server: ${run.command}');
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
	} catch(error) {
		languageClient = null;
		// await displayError(
		// 	'Failed to start Chutney Language Server'
		// );
	}
}

export async function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "vscode-chutney" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('vscode-chutney.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Chutney LSP!');
	});

	context.subscriptions.push(disposable);

	outputChannel = window.createOutputChannel('Chutney');
	await startLanguageServer();
}

// This method is called when your extension is deactivated
export function deactivate() {}
