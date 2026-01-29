import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { getHeaderTemplate, getSourceTemplate, getUiTemplate, getQrcTemplate, getCppHeaderTemplate, getCppSourceTemplate } from './templates';

export function activate(context: vscode.ExtensionContext) {

    // Command: Create Non-UI Class (Context Menu / Palette)
    let createClassDisposable = vscode.commands.registerCommand('qt-any.createClass', async (uri: vscode.Uri) => {
        await createQtClass(uri, false);
    });

    // Command: Create UI Class (Context Menu / Palette)
    let createUiClassDisposable = vscode.commands.registerCommand('qt-any.createUiClass', async (uri: vscode.Uri) => {
        await createQtClass(uri, true);
    });

    // Command: Create C++ Class (Context Menu / Palette)
    let createCppClassDisposable = vscode.commands.registerCommand('qt-any.createCppClass', async (uri: vscode.Uri) => {
        await createCppClass(uri);
    });

    // Command: Create QRC File (Context Menu / Palette)
    let createQrcDisposable = vscode.commands.registerCommand('qt-any.createQrc', async (uri: vscode.Uri) => {
        await createQrcFile(uri);
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
    context.subscriptions.push(createCppClassDisposable);
    context.subscriptions.push(createQrcDisposable);
    context.subscriptions.push(openDesignerDisposable);
    context.subscriptions.push(openLinguistDisposable);
}

async function createQrcFile(uri: vscode.Uri) {
    let targetPath = uri ? uri.fsPath : undefined;

    // If no path provided, ask user to pick folder
    if (!targetPath) {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t('Select Folder')
        });
        if (folders && folders.length > 0) {
            targetPath = folders[0].fsPath;
        }
    }

    if (!targetPath) {
        return; // User cancelled
    }

    // Ask for filename
    const fileName = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter QRC Filename (without extension)'),
        placeHolder: 'resources',
        validateInput: (text) => {
            if (!text || text.trim().length === 0) {
                return vscode.l10n.t('Filename cannot be empty');
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(text)) {
                return vscode.l10n.t('Invalid filename');
            }
            return null;
        }
    });

    if (!fileName) {
        return;
    }

    const qrcPath = path.join(targetPath, `${fileName}.qrc`);

    if (fs.existsSync(qrcPath)) {
        vscode.window.showErrorMessage(vscode.l10n.t('File "{0}" already exists!', `${fileName}.qrc`));
        return;
    }

    try {
        fs.writeFileSync(qrcPath, getQrcTemplate());
        vscode.window.showInformationMessage(vscode.l10n.t('Qt resource file "{0}" created successfully!', `${fileName}.qrc`));
        
        // Open created file
        const doc = await vscode.workspace.openTextDocument(qrcPath);
        await vscode.window.showTextDocument(doc);
    } catch (err: any) {
        vscode.window.showErrorMessage(vscode.l10n.t('Error creating file: {0}', err.message));
    }
}

async function createQtClass(uri: vscode.Uri, hasUi: boolean) {
    let targetPath = uri ? uri.fsPath : undefined;

    // If no path provided (e.g. command palette), ask user to pick folder
    if (!targetPath) {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t('Select Folder')
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
        prompt: vscode.l10n.t('Enter Qt Class Name'),
        placeHolder: 'MyClass',
        validateInput: (text) => {
            if (!text || text.trim().length === 0) {
                return vscode.l10n.t('Class name cannot be empty');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
                return vscode.l10n.t('Invalid class name');
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
            placeHolder: vscode.l10n.t('Select Base Class'),
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
        { label: vscode.l10n.t('Lowercase'), description: vscode.l10n.t('e.g. {0}', className.toLowerCase()), detail: vscode.l10n.t('Use all lowercase for filenames') },
        { label: vscode.l10n.t('Keep Case'), description: vscode.l10n.t('e.g. {0}', className), detail: vscode.l10n.t('Use class name casing for filenames') },
        { label: vscode.l10n.t('Custom...'), description: '', detail: vscode.l10n.t('Enter a custom filename') }
    ];

    const selectedNaming = await vscode.window.showQuickPick(namingOptions, {
        placeHolder: vscode.l10n.t('Select Filename Style'),
        canPickMany: false
    });

    if (!selectedNaming) {
        return;
    }

    if (selectedNaming.label === vscode.l10n.t('Keep Case')) {
        baseFileName = className;
    } else if (selectedNaming.label === vscode.l10n.t('Custom...')) {
        const customName = await vscode.window.showInputBox({
            prompt: vscode.l10n.t('Enter Filename (without extension)'),
            placeHolder: 'my_custom_filename',
            validateInput: (text) => {
                if (!text || text.trim().length === 0) {
                    return vscode.l10n.t('Filename cannot be empty');
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(text)) {
                    return vscode.l10n.t('Invalid filename');
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

async function createCppClass(uri: vscode.Uri) {
    let targetPath = uri ? uri.fsPath : undefined;

    // If no path provided, ask user to pick folder
    if (!targetPath) {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t('Select Folder')
        });
        if (folders && folders.length > 0) {
            targetPath = folders[0].fsPath;
        }
    }

    if (!targetPath) {
        return;
    }

    // Ask for class name
    const className = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter Class Name'),
        placeHolder: 'MyClass',
        validateInput: (text) => {
            if (!text || text.trim().length === 0) {
                return vscode.l10n.t('Class name cannot be empty');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
                return vscode.l10n.t('Invalid class name');
            }
            return null;
        }
    });

    if (!className) {
        return;
    }

    // Determine filename
    let baseFileName = className.toLowerCase();
    
    const namingOptions = [
        { label: vscode.l10n.t('Lowercase'), description: vscode.l10n.t('e.g. {0}', className.toLowerCase()), detail: vscode.l10n.t('Use all lowercase for filenames') },
        { label: vscode.l10n.t('Keep Case'), description: vscode.l10n.t('e.g. {0}', className), detail: vscode.l10n.t('Use class name casing for filenames') },
        { label: vscode.l10n.t('Custom...'), description: '', detail: vscode.l10n.t('Enter a custom filename') }
    ];

    const selectedNaming = await vscode.window.showQuickPick(namingOptions, {
        placeHolder: vscode.l10n.t('Select Filename Style'),
        canPickMany: false
    });

    if (!selectedNaming) {
        return;
    }

    if (selectedNaming.label === vscode.l10n.t('Keep Case')) {
        baseFileName = className;
    } else if (selectedNaming.label === vscode.l10n.t('Custom...')) {
        const customName = await vscode.window.showInputBox({
            prompt: vscode.l10n.t('Enter Filename (without extension)'),
            placeHolder: 'my_custom_filename',
            validateInput: (text) => {
                if (!text || text.trim().length === 0) {
                    return vscode.l10n.t('Filename cannot be empty');
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(text)) {
                    return vscode.l10n.t('Invalid filename');
                }
                return null;
            }
        });
        if (!customName) {
            return;
        }
        baseFileName = customName;
    }

    // Create Files
    const headerPath = path.join(targetPath, `${baseFileName}.h`);
    const sourcePath = path.join(targetPath, `${baseFileName}.cpp`);

    if (fs.existsSync(headerPath) || fs.existsSync(sourcePath)) {
        vscode.window.showErrorMessage(vscode.l10n.t('Files for class "{0}" already exist!', className));
        return;
    }

    try {
        fs.writeFileSync(headerPath, getCppHeaderTemplate(className));
        fs.writeFileSync(sourcePath, getCppSourceTemplate(className, baseFileName));

        vscode.window.showInformationMessage(vscode.l10n.t('C++ class "{0}" created successfully!', className));
        
        // Open created header file
        const doc = await vscode.workspace.openTextDocument(headerPath);
        await vscode.window.showTextDocument(doc);
    } catch (err: any) {
        vscode.window.showErrorMessage(vscode.l10n.t('Error creating files: {0}', err.message));
    }
}

async function createClassFiles(targetPath: string, className: string, baseClass: string, hasUi: boolean, baseFileName: string) {
    // Determine filename base
    const baseName = baseFileName;
    
    const headerPath = path.join(targetPath, `${baseName}.h`);
    const sourcePath = path.join(targetPath, `${baseName}.cpp`);
    const uiPath = hasUi ? path.join(targetPath, `${baseName}.ui`) : undefined;

    // Check if files exist
    if (fs.existsSync(headerPath) || fs.existsSync(sourcePath) || (uiPath && fs.existsSync(uiPath))) {
        vscode.window.showErrorMessage(vscode.l10n.t('Files for class "{0}" already exist!', className));
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

        vscode.window.showInformationMessage(vscode.l10n.t('Qt class "{0}" created successfully!', className));
        
        // Open created header file
        const doc = await vscode.workspace.openTextDocument(headerPath);
        await vscode.window.showTextDocument(doc);

    } catch (err: any) {
        vscode.window.showErrorMessage(vscode.l10n.t('Error creating files: {0}', err.message));
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
        vscode.window.showErrorMessage(vscode.l10n.t('No .ui file selected.'));
        return;
    }

    const config = vscode.workspace.getConfiguration('qt-any');
    let qtPath = config.get<string>('qtPath');

    if (!qtPath || qtPath.trim().length === 0) {
        const selection = await vscode.window.showWarningMessage(
            vscode.l10n.t('Qt path is not configured.'),
            vscode.l10n.t('Configure Now')
        );
        if (selection === vscode.l10n.t('Configure Now')) {
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
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to open Qt Designer: {0}', err.message));
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
        vscode.window.showErrorMessage(vscode.l10n.t('No .ts file selected.'));
        return;
    }

    // Verify file content is a Qt translation file
    try {
        const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' });
        // Read first 1000 chars to check for TS tag
        const header = fileContent.substring(0, 1000);
        if (!header.includes('<TS') && !header.includes('<!DOCTYPE TS>')) {
            vscode.window.showErrorMessage(vscode.l10n.t('The file "{0}" does not appear to be a valid Qt translation file.', path.basename(filePath)));
            return;
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to read file: {0}', err.message));
        return;
    }

    const config = vscode.workspace.getConfiguration('qt-any');
    let qtPath = config.get<string>('qtPath');

    if (!qtPath || qtPath.trim().length === 0) {
        const selection = await vscode.window.showWarningMessage(
            vscode.l10n.t('Qt path is not configured.'),
            vscode.l10n.t('Configure Now')
        );
        if (selection === vscode.l10n.t('Configure Now')) {
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
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to open Qt Linguist: {0}', err.message));
            console.error(err);
        }
    });
}

export function deactivate() {}
