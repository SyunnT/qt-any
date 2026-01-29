import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Provider for Qt Resource File (.qrc) custom editor.
 */
export class QrcEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'qt-any.qrcEditor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new QrcEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(QrcEditorProvider.viewType, provider);
        return providerRegistration;
    }

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    /**
     * Called when our custom editor is opened.
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        const localResourceRoots = [
            vscode.Uri.joinPath(this.context.extensionUri, 'media'),
            vscode.Uri.file(path.dirname(document.uri.fsPath))
        ];

        if (vscode.workspace.workspaceFolders) {
            localResourceRoots.push(...vscode.workspace.workspaceFolders.map(f => f.uri));
        }

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: localResourceRoots
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText()
            });
        }

        // Hook up event handlers so that we can synchronize the webview with the text document.
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // Update webview when it becomes visible again (e.g. switching back from XML editor)
        webviewPanel.onDidChangeViewState(e => {
            if (webviewPanel.visible) {
                updateWebview();
            }
        });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'update':
                    this.updateTextDocument(document, e.text);
                    return;
                case 'preview':
                    this.handlePreviewRequest(webviewPanel, document, e.filePath);
                    return;
                case 'addFile':
                    this.handleAddFile(webviewPanel, document);
                    return;
                case 'requestAddPrefix':
                    this.handleRequestAddPrefix(webviewPanel);
                    return;
                case 'showWarning':
                    vscode.window.showWarningMessage(e.message);
                    return;
                case 'editAsXml':
                    vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
                    return;
                case 'copyToClipboard':
                    vscode.env.clipboard.writeText(e.text);
                    vscode.window.showInformationMessage(vscode.l10n.t("Resource path copied to clipboard!"));
                    return;
            }
        });

        updateWebview();
    }

    private async handleRequestAddPrefix(panel: vscode.WebviewPanel) {
        const prefix = await vscode.window.showInputBox({
            prompt: vscode.l10n.t("Enter new prefix"),
            value: "/new/prefix"
        });
        if (prefix) {
            if (!prefix.startsWith('/')) {
                vscode.window.showErrorMessage(vscode.l10n.t("Prefix must start with '/'"));
                return;
            }
            panel.webview.postMessage({
                type: 'addPrefix',
                prefix: prefix
            });
        }
    }

    private async handleAddFile(panel: vscode.WebviewPanel, document: vscode.TextDocument) {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: vscode.l10n.t('Add Files')
        });

        if (uris && uris.length > 0) {
            const qrcDir = path.dirname(document.uri.fsPath);
            const relativePaths = uris.map(uri => path.relative(qrcDir, uri.fsPath).replace(/\\/g, '/'));
            
            panel.webview.postMessage({
                type: 'addFiles',
                files: relativePaths
            });
        }
    }

    private async handlePreviewRequest(panel: vscode.WebviewPanel, document: vscode.TextDocument, filePath: string) {
        try {
            // Resolve path relative to the qrc file
            const qrcDir = path.dirname(document.uri.fsPath);
            const absolutePath = path.join(qrcDir, filePath);
            const uri = vscode.Uri.file(absolutePath);

            const ext = path.extname(absolutePath).toLowerCase();
            const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.ico'];
            const textExts = ['.txt', '.cpp', '.h', '.js', '.ts', '.json', '.xml', '.html', '.css', '.qml', '.ui', '.md'];

            if (imageExts.includes(ext)) {
                // For images, we need a webview URI
                const webviewUri = panel.webview.asWebviewUri(uri);
                panel.webview.postMessage({
                    type: 'previewContent',
                    contentType: 'image',
                    content: webviewUri.toString()
                });
            } else if (textExts.includes(ext)) {
                // For text, read file content
                const doc = await vscode.workspace.openTextDocument(uri);
                panel.webview.postMessage({
                    type: 'previewContent',
                    contentType: 'text',
                    content: doc.getText()
                });
            } else {
                panel.webview.postMessage({
                    type: 'previewContent',
                    contentType: 'unknown',
                    content: vscode.l10n.t('Preview not available for this file type.')
                });
            }
        } catch (error: any) {
            panel.webview.postMessage({
                type: 'previewContent',
                contentType: 'error',
                content: vscode.l10n.t('Error loading file: {0}', error.message)
            });
        }
    }

    /**
     * Write out the text to the document.
     */
    private updateTextDocument(document: vscode.TextDocument, text: string) {
        const edit = new vscode.WorkspaceEdit();

        // Just replace the entire document every time for this simple editor.
        // A more complete implementation would compute minimal edits.
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            text
        );

        return vscode.workspace.applyEdit(edit);
    }

    /**
     * Get the static html used for the editor webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        const i18n = {
            addPrefix: vscode.l10n.t("Add Prefix"),
            addFiles: vscode.l10n.t("Add Files"),
            remove: vscode.l10n.t("Remove"),
            editAsXml: vscode.l10n.t("Edit as XML"),
            selectFileToPreview: vscode.l10n.t("Select a file to preview"),
            areYouSure: vscode.l10n.t("Are you sure?"),
            yes: vscode.l10n.t("Yes"),
            no: vscode.l10n.t("No"),
            closePreview: vscode.l10n.t("Close Preview"),
            removePrefixConfirm: vscode.l10n.t("Remove prefix '{0}' and all its files?"),
            removeFileConfirm: vscode.l10n.t("Remove file '{0}'?"),
            pleaseSelectPrefix: vscode.l10n.t("Please select a prefix first."),
            copyResourcePath: vscode.l10n.t("Copy Resource Path")
        };

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Qt Resource Editor</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        display: flex;
                        height: 100vh;
                        margin: 0;
                        overflow: hidden;
                    }
                    .sidebar {
                        min-width: 300px;
                        width: fit-content;
                        flex-shrink: 0;
                        border-right: 1px solid var(--vscode-panel-border);
                        display: flex;
                        flex-direction: column;
                        background-color: var(--vscode-sideBar-background);
                    }
                    .toolbar {
                        padding: 8px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        display: flex;
                        gap: 8px;
                        white-space: nowrap;
                    }
                    .tree-container {
                        flex: 1;
                        overflow-y: auto;
                        padding: 8px;
                    }
                    .preview-container {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        padding: 0;
                        overflow: hidden;
                        background-color: var(--vscode-editor-background);
                        position: relative;
                    }
                    .preview-header {
                        display: flex;
                        justify-content: flex-end;
                        padding: 8px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        width: 100%;
                        box-sizing: border-box;
                        background-color: var(--vscode-editor-background);
                        flex-shrink: 0;
                        z-index: 10;
                    }
                    #previewBody {
                        flex: 1;
                        overflow: auto;
                        padding: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 12px;
                        cursor: pointer;
                        font-family: inherit;
                        white-space: nowrap;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .tree-item {
                        padding: 4px 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    }
                    .tree-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    .tree-item.selected {
                        background-color: var(--vscode-list-activeSelectionBackground);
                        color: var(--vscode-list-activeSelectionForeground);
                    }
                    .prefix-node {
                        font-weight: bold;
                    }
                    .file-node {
                        padding-left: 24px;
                    }
                    img.preview {
                        max-width: 100%;
                        max-height: 100%;
                        border: 1px solid var(--vscode-panel-border);
                        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    }
                    pre.preview {
                        background-color: var(--vscode-textBlockQuote-background);
                        padding: 16px;
                        border: 1px solid var(--vscode-textBlockQuote-border);
                        width: 100%;
                        overflow: auto;
                        white-space: pre-wrap;
                    }
                    .empty-state {
                        color: var(--vscode-descriptionForeground);
                        text-align: center;
                        padding: 16px;
                        margin: auto;
                    }
                    /* Modal Styles */
                    .modal-overlay {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.5);
                        z-index: 1000;
                    }
                    .modal-content {
                        background-color: var(--vscode-editorWidget-background);
                        color: var(--vscode-editorWidget-foreground);
                        border: 1px solid var(--vscode-widget-border);
                        padding: 16px;
                        min-width: 250px;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                        position: absolute;
                    }
                    .modal-message {
                        margin-bottom: 8px;
                    }
                    .modal-buttons {
                        display: flex;
                        justify-content: flex-end;
                        gap: 8px;
                    }
                    .modal-buttons button {
                        min-width: 60px;
                    }
                    /* Context Menu */
                    .context-menu {
                        display: none;
                        position: fixed;
                        z-index: 10000;
                        width: 200px;
                        background-color: var(--vscode-menu-background);
                        color: var(--vscode-menu-foreground);
                        border: 1px solid var(--vscode-menu-border);
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                        padding: 4px 0;
                    }
                    .context-menu-item {
                        padding: 6px 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    }
                    .context-menu-item:hover {
                        background-color: var(--vscode-menu-selectionBackground);
                        color: var(--vscode-menu-selectionForeground);
                    }
                </style>
            </head>
            <body>
                <div class="sidebar">
                    <div class="toolbar">
                        <button id="addPrefixBtn">${i18n.addPrefix}</button>
                        <button id="addFileBtn">${i18n.addFiles}</button>
                        <button id="removeBtn">${i18n.remove}</button>
                        <button id="editAsXmlBtn">${i18n.editAsXml}</button>
                    </div>
                    <div class="tree-container" id="treeRoot"></div>
                </div>
                <div class="preview-container" id="previewContainer">
                    <div class="empty-state" id="emptyState">${i18n.selectFileToPreview}</div>
                    <div id="previewContent" style="display:none; width: 100%; height: 100%; flex-direction: column;">
                         <div class="preview-header">
                            <button id="closePreviewBtn">${i18n.closePreview}</button>
                         </div>
                         <div id="previewBody"></div>
                    </div>
                </div>

                <!-- Custom Modal -->
                <div id="confirmationModal" class="modal-overlay">
                    <div class="modal-content">
                        <div id="modalMessage" class="modal-message">${i18n.areYouSure}</div>
                        <div class="modal-buttons">
                            <button id="modalYesBtn">${i18n.yes}</button>
                            <button id="modalNoBtn">${i18n.no}</button>
                        </div>
                    </div>
                </div>

                <!-- Context Menu -->
                <div id="contextMenu" class="context-menu">
                    <div class="context-menu-item" id="copyResourcePathItem">${i18n.copyResourcePath}</div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const i18n = ${JSON.stringify(i18n)};
                    let qrcData = { qresource: [] };
                    let selectedNode = null;

                    // Initial state
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                parseXml(message.text);
                                renderTree();
                                break;
                            case 'previewContent':
                                renderPreview(message.contentType, message.content);
                                break;
                            case 'addFiles':
                                addFilesToSelectedPrefix(message.files);
                                break;
                            case 'addPrefix':
                                qrcData.qresource.push({ prefix: message.prefix, files: [] });
                                updateModel();
                                renderTree();
                                break;
                            case 'deleteNode':
                                if (selectedNode) {
                                    if (selectedNode.type === 'prefix') {
                                        qrcData.qresource.splice(selectedNode.index, 1);
                                    } else if (selectedNode.type === 'file') {
                                        qrcData.qresource[selectedNode.qrIndex].files.splice(selectedNode.fIndex, 1);
                                    }
                                    selectedNode = null;
                                    updateModel();
                                    renderTree();
                                    closePreview();
                                }
                                break;
                        }
                    });

                    function parseXml(xmlText) {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                        
                        qrcData = { qresource: [] };
                        const qresources = xmlDoc.getElementsByTagName('qresource');
                        
                        for (let i = 0; i < qresources.length; i++) {
                            const qr = qresources[i];
                            const prefix = qr.getAttribute('prefix') || '/';
                            const files = [];
                            
                            const fileNodes = qr.getElementsByTagName('file');
                            for (let j = 0; j < fileNodes.length; j++) {
                                const fileNode = fileNodes[j];
                                const alias = fileNode.getAttribute('alias');
                                const path = fileNode.textContent;
                                files.push({ alias, path });
                            }
                            
                            qrcData.qresource.push({ prefix, files });
                        }
                    }

                    function generateXml() {
                        let xml = '<!DOCTYPE RCC>\\n<RCC version="1.0">\\n';
                        
                        qrcData.qresource.forEach(qr => {
                            xml += '    <qresource prefix="' + qr.prefix + '">\\n';
                            qr.files.forEach(f => {
                                if (f.alias) {
                                    xml += '        <file alias="' + f.alias + '">' + f.path + '</file>\\n';
                                } else {
                                    xml += '        <file>' + f.path + '</file>\\n';
                                }
                            });
                            xml += '    </qresource>\\n';
                        });
                        
                        xml += '</RCC>';
                        return xml;
                    }

                    function updateModel() {
                        const xml = generateXml();
                        vscode.postMessage({
                            type: 'update',
                            text: xml
                        });
                    }

                    function renderTree() {
                        const root = document.getElementById('treeRoot');
                        root.innerHTML = '';
                        
                        qrcData.qresource.forEach((qr, qrIndex) => {
                            // Prefix Node
                            const prefixDiv = document.createElement('div');
                            prefixDiv.className = 'tree-item prefix-node';
                            prefixDiv.textContent = qr.prefix;
                            prefixDiv.dataset.type = 'prefix';
                            prefixDiv.dataset.index = qrIndex;
                            
                            if (selectedNode && selectedNode.type === 'prefix' && selectedNode.index === qrIndex) {
                                prefixDiv.classList.add('selected');
                            }
                            
                            prefixDiv.onclick = () => selectNode('prefix', qrIndex);
                            root.appendChild(prefixDiv);
                            
                            // File Nodes
                            qr.files.forEach((f, fIndex) => {
                                const fileDiv = document.createElement('div');
                                fileDiv.className = 'tree-item file-node';
                                fileDiv.textContent = f.alias ? f.path + ' (' + f.alias + ')' : f.path;
                                fileDiv.dataset.type = 'file';
                                fileDiv.dataset.qrIndex = qrIndex;
                                fileDiv.dataset.fIndex = fIndex;
                                
                                if (selectedNode && selectedNode.type === 'file' && selectedNode.qrIndex === qrIndex && selectedNode.fIndex === fIndex) {
                                    fileDiv.classList.add('selected');
                                }
                                
                                fileDiv.onclick = (e) => {
                                    e.stopPropagation();
                                    selectNode('file', qrIndex, fIndex);
                                    requestPreview(f.path);
                                };

                                fileDiv.oncontextmenu = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    selectNode('file', qrIndex, fIndex);
                                    
                                    // Calculate resource path
                                    const prefix = qr.prefix;
                                    const resourcePath = ':/' + (prefix.endsWith('/') ? prefix.substring(1) : (prefix.startsWith('/') ? prefix.substring(1) : prefix) + '/') + (f.alias ? f.alias : f.path);
                                    // Clean up double slashes if any, though the logic above tries to handle it.
                                    // Standard logic: ":/" + prefix (trimmed of leading slash) + "/" + aliasOrPath
                                    // Wait, if prefix is "/", it becomes ":/" + "" + "/" + path -> "://path". 
                                    // Qt doc says ":/path/to/file.png".
                                    // So if prefix is "/", resource path is ":/" + path.
                                    // If prefix is "/res", resource path is ":/res/" + path.
                                    
                                    let cleanPrefix = prefix;
                                    if (cleanPrefix.startsWith('/')) cleanPrefix = cleanPrefix.substring(1);
                                    if (cleanPrefix.endsWith('/')) cleanPrefix = cleanPrefix.substring(0, cleanPrefix.length - 1);
                                    
                                    let finalPath = ':/' + (cleanPrefix ? cleanPrefix + '/' : '') + (f.alias ? f.alias : f.path);
                                    
                                    showContextMenu(e.clientX, e.clientY, finalPath);
                                };

                                root.appendChild(fileDiv);
                            });
                        });
                    }

                    function selectNode(type, index1, index2) {
                        selectedNode = { type, index: index1, qrIndex: index1, fIndex: index2 };
                        renderTree(); // Re-render to update selection style
                    }

                    function requestPreview(filePath) {
                        const previewBody = document.getElementById('previewBody');
                        const emptyState = document.getElementById('emptyState');
                        const previewContent = document.getElementById('previewContent');
                        
                        emptyState.style.display = 'none';
                        previewContent.style.display = 'flex';
                        previewBody.innerHTML = '<div class="empty-state">Loading...</div>';
                        
                        vscode.postMessage({
                            type: 'preview',
                            filePath: filePath
                        });
                    }

                    function renderPreview(type, content) {
                        const previewBody = document.getElementById('previewBody');
                        previewBody.innerHTML = '';
                        
                        if (type === 'image') {
                            const img = document.createElement('img');
                            img.className = 'preview';
                            img.src = content;
                            previewBody.appendChild(img);
                        } else if (type === 'text') {
                            const pre = document.createElement('pre');
                            pre.className = 'preview';
                            pre.textContent = content;
                            previewBody.appendChild(pre);
                        } else {
                            const div = document.createElement('div');
                            div.className = 'empty-state';
                            div.textContent = content;
                            previewBody.appendChild(div);
                        }
                    }

                    function closePreview() {
                        const emptyState = document.getElementById('emptyState');
                        const previewContent = document.getElementById('previewContent');
                        const previewBody = document.getElementById('previewBody');
                        
                        emptyState.style.display = 'block';
                        previewContent.style.display = 'none';
                        previewBody.innerHTML = '';
                    }

                    document.getElementById('closePreviewBtn').addEventListener('click', closePreview);

                    // Button Handlers
                    document.getElementById('addPrefixBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'requestAddPrefix' });
                    });

                    document.getElementById('addFileBtn').addEventListener('click', () => {
                        if (!selectedNode || selectedNode.type !== 'prefix') {
                            vscode.postMessage({ 
                                type: 'showWarning', 
                                message: i18n.pleaseSelectPrefix
                            });
                            return;
                        }
                        vscode.postMessage({ type: 'addFile' });
                    });
                    
                    function addFilesToSelectedPrefix(filePaths) {
                        if (!selectedNode || selectedNode.type !== 'prefix') return;
                        
                        const qr = qrcData.qresource[selectedNode.index];
                        
                        filePaths.forEach(path => {
                            qr.files.push({ path: path, alias: '' });
                        });
                        
                        updateModel();
                        renderTree();
                    }

                    document.getElementById('removeBtn').addEventListener('click', () => {
                        if (!selectedNode) return;
                        
                        let msg = "";
                        if (selectedNode.type === 'prefix') {
                            msg = i18n.removePrefixConfirm.replace('{0}', qrcData.qresource[selectedNode.index].prefix);
                        } else {
                            msg = i18n.removeFileConfirm.replace('{0}', qrcData.qresource[selectedNode.qrIndex].files[selectedNode.fIndex].path);
                        }

                        showModal(msg, () => {
                            if (selectedNode) {
                                if (selectedNode.type === 'prefix') {
                                    qrcData.qresource.splice(selectedNode.index, 1);
                                } else if (selectedNode.type === 'file') {
                                    qrcData.qresource[selectedNode.qrIndex].files.splice(selectedNode.fIndex, 1);
                                }
                                selectedNode = null;
                                updateModel();
                                renderTree();
                                closePreview();
                            }
                        });
                    });

                    // Modal Logic
                    const modal = document.getElementById('confirmationModal');
                    const modalMessage = document.getElementById('modalMessage');
                    const modalYesBtn = document.getElementById('modalYesBtn');
                    const modalNoBtn = document.getElementById('modalNoBtn');
                    let modalCallback = null;

                    function showModal(message, callback) {
                        modalMessage.textContent = message;
                        modalCallback = callback;
                        
                        // Position modal near the Remove button
                        const removeBtn = document.getElementById('removeBtn');
                        const rect = removeBtn.getBoundingClientRect();
                        const modalContent = document.querySelector('.modal-content');
                        
                        // Calculate position (below the button, slightly offset)
                        modalContent.style.top = (rect.bottom + 5) + 'px';
                        modalContent.style.left = rect.left + 'px';
                        
                        modal.style.display = 'flex';
                    }

                    function hideModal() {
                        modal.style.display = 'none';
                        modalCallback = null;
                    }

                    modalYesBtn.addEventListener('click', () => {
                        if (modalCallback) modalCallback();
                        hideModal();
                    });

                    modalNoBtn.addEventListener('click', () => {
                        hideModal();
                    });

                    // Close modal when clicking outside
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            hideModal();
                        }
                    });

                    document.getElementById('editAsXmlBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'editAsXml' });
                    });

                    // Context Menu Logic
                    const contextMenu = document.getElementById('contextMenu');
                    const copyResourcePathItem = document.getElementById('copyResourcePathItem');
                    let currentResourcePath = '';

                    function showContextMenu(x, y, path) {
                        currentResourcePath = path;
                        contextMenu.style.left = x + 'px';
                        contextMenu.style.top = y + 'px';
                        contextMenu.style.display = 'block';
                    }

                    function hideContextMenu() {
                        contextMenu.style.display = 'none';
                    }

                    document.addEventListener('click', () => {
                        hideContextMenu();
                    });

                    contextMenu.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });

                    copyResourcePathItem.addEventListener('click', () => {
                        if (currentResourcePath) {
                            // Try to use clipboard API first
                            // Note: navigator.clipboard might be restricted in webview
                            // So we fallback/use postMessage to be safe
                            vscode.postMessage({
                                type: 'copyToClipboard',
                                text: currentResourcePath
                            });
                            hideContextMenu();
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
