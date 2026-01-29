import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { getHeaderTemplate, getSourceTemplate, getUiTemplate } from './templates';
import { QtCreatorViewProvider } from './qtCreatorView';

export function activate(context: vscode.ExtensionContext) {

    // Register Webview View Provider
    const provider = new QtCreatorViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(QtCreatorViewProvider.viewType, provider)
    );

    // Command: Create Class from View (Internal)
    context.subscriptions.push(vscode.commands.registerCommand('qt-any.internal.createClass', async (data) => {
        // data.keepCase comes from the webview
        await createClassFiles(data.path, data.className, data.baseClass, data.hasUi, data.keepCase);
    }));

    // Command: Create Non-UI Class (Context Menu / Palette)
    let createClassDisposable = vscode.commands.registerCommand('qt-any.createClass', async (uri: vscode.Uri) => {
        await createQtClass(uri, false);
    });

    // Command: Create UI Class (Context Menu / Palette)
    let createUiClassDisposable = vscode.commands.registerCommand('qt-any.createUiClass', async (uri: vscode.Uri) => {
        await createQtClass(uri, true);
    });

    // Command: Open in Qt Designer
    let openDesignerDisposable = vscode.commands.registerCommand('qt-any.openInDesigner', async (uri: vscode.Uri) => {
        await openInDesigner(uri);
    });

    context.subscriptions.push(createClassDisposable);
    context.subscriptions.push(createUiClassDisposable);
    context.subscriptions.push(openDesignerDisposable);
}

async function createQtClass(uri: vscode.Uri, hasUi: boolean) {
    let targetPath = uri ? uri.fsPath : undefined;

    // If no path provided (e.g. command palette), ask user to pick folder
    if (!targetPath) {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Folder'
        });
        if (folders && folders.length > 0) {
            targetPath = folders[0].fsPath;
        }
    }

    if (!targetPath) {
        return; // User cancelled
    }

    // Ask for class name
    const className = await vscode.window.showInputBox({
        prompt: 'Enter Qt Class Name',
        placeHolder: 'MyClass',
        validateInput: (text) => {
            if (!text || text.trim().length === 0) {
                return 'Class name cannot be empty';
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
                return 'Invalid class name';
            }
            return null;
        }
    });

    if (!className) {
        return;
    }

    // Default base classes for context menu commands
    const baseClass = hasUi ? 'QWidget' : 'QObject';
    // Default keepCase to false for context menu (legacy behavior)
    await createClassFiles(targetPath, className, baseClass, hasUi, false);
}

async function createClassFiles(targetPath: string, className: string, baseClass: string, hasUi: boolean, keepCase: boolean) {
    // Determine filename base
    const baseName = keepCase ? className : className.toLowerCase();
    
    const headerPath = path.join(targetPath, `${baseName}.h`);
    const sourcePath = path.join(targetPath, `${baseName}.cpp`);
    const uiPath = hasUi ? path.join(targetPath, `${baseName}.ui`) : undefined;

    // Check if files exist
    if (fs.existsSync(headerPath) || fs.existsSync(sourcePath) || (uiPath && fs.existsSync(uiPath))) {
        vscode.window.showErrorMessage(`Files for class "${className}" already exist!`);
        return;
    }

    try {
        // Write files
        // Pass baseName to getSourceTemplate so it includes the correct header file
        fs.writeFileSync(headerPath, getHeaderTemplate(className, baseClass, hasUi));
        fs.writeFileSync(sourcePath, getSourceTemplate(className, baseClass, hasUi, baseName));
        if (uiPath) {
            fs.writeFileSync(uiPath, getUiTemplate(className, baseClass));
        }

        vscode.window.showInformationMessage(`Qt class "${className}" created successfully!`);
        
        // Open created header file
        const doc = await vscode.workspace.openTextDocument(headerPath);
        await vscode.window.showTextDocument(doc);

    } catch (err: any) {
        vscode.window.showErrorMessage(`Error creating files: ${err.message}`);
    }
}

async function openInDesigner(uri: vscode.Uri) {
    let filePath = uri ? uri.fsPath : undefined;
    
    if (!filePath || !filePath.endsWith('.ui')) {
        // Try to find current active editor if it's a .ui file
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('.ui')) {
            filePath = editor.document.fileName;
        }
    }

    if (!filePath) {
        vscode.window.showErrorMessage('No .ui file selected.');
        return;
    }

    const config = vscode.workspace.getConfiguration('qt-any');
    let designerPath = config.get<string>('designerPath');

    if (!designerPath || designerPath.trim().length === 0) {
        const selection = await vscode.window.showWarningMessage(
            'Qt Designer path is not configured.',
            'Configure Now'
        );
        if (selection === 'Configure Now') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'qt-any.designerPath');
        }
        return;
    }

    // Execute designer
    // Use quotes around paths to handle spaces
    const command = `"${designerPath}" "${filePath}"`;
    
    cp.exec(command, (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage(`Failed to open Qt Designer: ${err.message}`);
            console.error(err);
        }
    });
}

export function deactivate() {}
