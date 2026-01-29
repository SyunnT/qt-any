import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { getHeaderTemplate, getSourceTemplate, getUiTemplate } from './templates';

export function activate(context: vscode.ExtensionContext) {

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

    // Command: Open in Qt Linguist
    let openLinguistDisposable = vscode.commands.registerCommand('qt-any.openInLinguist', async (uri: vscode.Uri) => {
        await openInLinguist(uri);
    });

    context.subscriptions.push(createClassDisposable);
    context.subscriptions.push(createUiClassDisposable);
    context.subscriptions.push(openDesignerDisposable);
    context.subscriptions.push(openLinguistDisposable);
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
    let baseClass = hasUi ? 'QWidget' : 'QObject';
    
    // If hasUi is true, let user select the base class
    if (hasUi) {
        const selectedBase = await vscode.window.showQuickPick(['QWidget', 'QMainWindow', 'QDialog'], {
            placeHolder: 'Select Base Class',
            canPickMany: false
        });
        
        if (!selectedBase) {
            return; // User cancelled
        }
        baseClass = selectedBase;
    }

    // Determine filename
    let baseFileName = className.toLowerCase();
    
    const namingOptions = [
        { label: 'Lowercase', description: `e.g. ${className.toLowerCase()}`, detail: 'Use all lowercase for filenames' },
        { label: 'Keep Case', description: `e.g. ${className}`, detail: 'Use class name casing for filenames' },
        { label: 'Custom...', description: '', detail: 'Enter a custom filename' }
    ];

    const selectedNaming = await vscode.window.showQuickPick(namingOptions, {
        placeHolder: 'Select Filename Style',
        canPickMany: false
    });

    if (!selectedNaming) {
        return;
    }

    if (selectedNaming.label === 'Keep Case') {
        baseFileName = className;
    } else if (selectedNaming.label === 'Custom...') {
        const customName = await vscode.window.showInputBox({
            prompt: 'Enter Filename (without extension)',
            placeHolder: 'my_custom_filename',
            validateInput: (text) => {
                if (!text || text.trim().length === 0) {
                    return 'Filename cannot be empty';
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(text)) {
                    return 'Invalid filename';
                }
                return null;
            }
        });
        if (!customName) {
            return;
        }
        baseFileName = customName;
    }

    await createClassFiles(targetPath, className, baseClass, hasUi, baseFileName);
}

async function createClassFiles(targetPath: string, className: string, baseClass: string, hasUi: boolean, baseFileName: string) {
    // Determine filename base
    const baseName = baseFileName;
    
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
    let qtPath = config.get<string>('qtPath');

    if (!qtPath || qtPath.trim().length === 0) {
        const selection = await vscode.window.showWarningMessage(
            'Qt path is not configured.',
            'Configure Now'
        );
        if (selection === 'Configure Now') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'qt-any.qtPath');
        }
        return;
    }

    // Construct path to designer executable
    const designerPath = path.join(qtPath, 'bin', 'designer.exe');

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

async function openInLinguist(uri: vscode.Uri) {
    let filePath = uri ? uri.fsPath : undefined;
    
    if (!filePath || !filePath.endsWith('.ts')) {
        // Try to find current active editor if it's a .ts file
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('.ts')) {
            filePath = editor.document.fileName;
        }
    }

    if (!filePath) {
        vscode.window.showErrorMessage('No .ts file selected.');
        return;
    }

    // Verify file content is a Qt translation file
    try {
        const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' });
        // Read first 1000 chars to check for TS tag
        const header = fileContent.substring(0, 1000);
        if (!header.includes('<TS') && !header.includes('<!DOCTYPE TS>')) {
            vscode.window.showErrorMessage(`The file "${path.basename(filePath)}" does not appear to be a valid Qt translation file.`);
            return;
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to read file: ${err.message}`);
        return;
    }

    const config = vscode.workspace.getConfiguration('qt-any');
    let qtPath = config.get<string>('qtPath');

    if (!qtPath || qtPath.trim().length === 0) {
        const selection = await vscode.window.showWarningMessage(
            'Qt path is not configured.',
            'Configure Now'
        );
        if (selection === 'Configure Now') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'qt-any.qtPath');
        }
        return;
    }

    // Construct path to linguist executable
    const linguistPath = path.join(qtPath, 'bin', 'linguist.exe');

    // Execute linguist
    // Use quotes around paths to handle spaces
    const command = `"${linguistPath}" "${filePath}"`;
    
    cp.exec(command, (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage(`Failed to open Qt Linguist: ${err.message}`);
            console.error(err);
        }
    });
}

export function deactivate() {}
