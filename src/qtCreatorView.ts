import * as vscode from 'vscode';

export class QtCreatorViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'qtClassCreator.view';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'createClass':
                    vscode.commands.executeCommand('qt-class-creator.internal.createClass', data);
                    break;
                case 'selectFolder':
                    this._selectFolder();
                    break;
            }
        });
    }

    private async _selectFolder() {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Folder'
        });
        if (folders && folders.length > 0) {
            if (this._view) {
                this._view.webview.postMessage({ type: 'folderSelected', path: folders[0].fsPath });
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qt Class Creator</title>
    <style>
        body {
            padding: 10px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
        }
        .section {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        select, input[type="text"] {
            width: 100%;
            padding: 5px;
            box-sizing: border-box;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            margin-bottom: 10px;
        }
        select:focus, input[type="text"]:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            cursor: pointer;
            width: 100%;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .folder-container {
            display: flex;
            gap: 5px;
        }
        .folder-container input {
            flex-grow: 1;
        }
        .folder-container button {
            width: auto;
        }
        .checkbox-container {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }
        .checkbox-container input {
            width: auto;
            margin-right: 8px;
        }
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="section">
        <label>Class Type</label>
        <select id="classType">
            <option value="ui">UI Class</option>
            <option value="non-ui">Non-UI Class</option>
        </select>
    </div>

    <div id="uiSection">
        <div class="section">
            <label>Inherits</label>
            <select id="baseClass">
                <option value="QWidget">QWidget</option>
                <option value="QDialog">QDialog</option>
                <option value="QMainWindow">QMainWindow</option>
            </select>
        </div>
    </div>

    <div class="section">
        <label>Location</label>
        <div class="folder-container">
            <input type="text" id="targetFolder" placeholder="Select folder..." readonly>
            <button id="selectFolderBtn">...</button>
        </div>
    </div>

    <div class="section">
        <label>Class Name</label>
        <input type="text" id="className" placeholder="MyClass">
    </div>

    <div class="checkbox-container">
        <input type="checkbox" id="keepCase" checked>
        <label for="keepCase" style="margin-bottom: 0; font-weight: normal;">文件名和类名保持一致</label>
    </div>

    <button id="createBtn">Create Class</button>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const classTypeSelect = document.getElementById('classType');
        const uiSection = document.getElementById('uiSection');
        const selectFolderBtn = document.getElementById('selectFolderBtn');
        const createBtn = document.getElementById('createBtn');
        const targetFolderInput = document.getElementById('targetFolder');
        const classNameInput = document.getElementById('className');
        const baseClassSelect = document.getElementById('baseClass');
        const keepCaseCheckbox = document.getElementById('keepCase');

        // Initial state
        let currentPath = '';

        // Handle Type Change
        classTypeSelect.addEventListener('change', () => {
            if (classTypeSelect.value === 'ui') {
                uiSection.classList.remove('hidden');
            } else {
                uiSection.classList.add('hidden');
            }
        });

        // Handle Folder Selection
        selectFolderBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'selectFolder' });
        });

        // Handle Messages from Extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'folderSelected':
                    currentPath = message.path;
                    targetFolderInput.value = currentPath;
                    break;
            }
        });

        // Handle Create
        createBtn.addEventListener('click', () => {
            const type = classTypeSelect.value;
            const className = classNameInput.value;
            const keepCase = keepCaseCheckbox.checked;
            
            if (!currentPath) {
                // Ideally show error in UI, but extension will handle validation too
                return;
            }

            if (!className) {
                return;
            }

            vscode.postMessage({
                type: 'createClass',
                hasUi: type === 'ui',
                baseClass: type === 'ui' ? baseClassSelect.value : 'QObject',
                className: className,
                path: currentPath,
                keepCase: keepCase
            });
        });
    </script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
