import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TemplateContext {
    projectName: string;
    cmakeMinVersion: string;
    qtMajorVersion?: string;
    libType?: 'STATIC' | 'SHARED';
    baseClass?: string;
    isSubProject: boolean;
    standard?: string;
    isC?: boolean;
}

export interface LocalConfig {
    fileGroups?: { [key: string]: string[] };
}

export class TemplateManager {
    private extensionPath: string;

    constructor(context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
    }

    public getUserTemplatesDir(): string {
        return path.join(os.homedir(), '.qt-any', 'templates');
    }

    public getTemplatePath(templateName: string, type: 'cmake' | 'header' = 'cmake'): string {
        // 1. Check user directory
        const userDir = path.join(this.getUserTemplatesDir(), type);
        const userPath = path.join(userDir, templateName);
        if (fs.existsSync(userPath)) {
            return userPath;
        }

        // 2. Fallback to extension directory
        return path.join(this.extensionPath, 'templates', type, templateName);
    }

    public async editTemplates() {
        // List all .cmake files in cmake/ and header/
        const builtInCmakeDir = path.join(this.extensionPath, 'templates', 'cmake');
        const builtInHeaderDir = path.join(this.extensionPath, 'templates', 'header');
        
        const userTemplatesDir = this.getUserTemplatesDir();
        const userCmakeDir = path.join(userTemplatesDir, 'cmake');
        const userHeaderDir = path.join(userTemplatesDir, 'header');

        interface TemplateItem extends vscode.QuickPickItem {
            filePath: string;
            isUser: boolean;
            type: 'cmake' | 'header';
            fileName: string;
        }

        let items: TemplateItem[] = [];
        
        // Helper to collect files
        const collectFiles = (dir: string, type: 'cmake' | 'header', isUser: boolean) => {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(file => file.endsWith('.cmake'));
                files.forEach(f => {
                    // Check if already added (for built-in, if user override exists, skip or mark)
                    // We will add all built-ins first, then user overrides will replace or appear alongside?
                    // Better strategy: Unique list by name. User takes precedence.
                    
                    // Actually, let's just collect everything and then sort/filter
                    // But wait, if we want to show "User defined" status, we need to know.
                });
                return files;
            }
            return [];
        };

        // Strategy: Get list of all available template names from built-in.
        // Also check if there are any extra in user dir (unlikely for now but possible).
        
        const allTemplates = new Set<string>();
        const builtInCmakeFiles = fs.existsSync(builtInCmakeDir) ? fs.readdirSync(builtInCmakeDir).filter(f => f.endsWith('.cmake')) : [];
        const builtInHeaderFiles = fs.existsSync(builtInHeaderDir) ? fs.readdirSync(builtInHeaderDir).filter(f => f.endsWith('.cmake')) : [];
        
        builtInCmakeFiles.forEach(f => items.push({
            label: `Project: ${f}`,
            description: fs.existsSync(path.join(userCmakeDir, f)) ? vscode.l10n.t('(User Override)') : vscode.l10n.t('(Default)'),
            detail: fs.existsSync(path.join(userCmakeDir, f)) ? path.join(userCmakeDir, f) : path.join(builtInCmakeDir, f),
            filePath: fs.existsSync(path.join(userCmakeDir, f)) ? path.join(userCmakeDir, f) : path.join(builtInCmakeDir, f),
            isUser: fs.existsSync(path.join(userCmakeDir, f)),
            type: 'cmake',
            fileName: f
        }));

        builtInHeaderFiles.forEach(f => items.push({
            label: `Header: ${f}`,
            description: fs.existsSync(path.join(userHeaderDir, f)) ? vscode.l10n.t('(User Override)') : vscode.l10n.t('(Default)'),
            detail: fs.existsSync(path.join(userHeaderDir, f)) ? path.join(userHeaderDir, f) : path.join(builtInHeaderDir, f),
            filePath: fs.existsSync(path.join(userHeaderDir, f)) ? path.join(userHeaderDir, f) : path.join(builtInHeaderDir, f),
            isUser: fs.existsSync(path.join(userHeaderDir, f)),
            type: 'header',
            fileName: f
        }));

        if (items.length === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t('No templates found.'));
            return;
        }

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t('Select a template to edit')
        });

        if (selected) {
            if (selected.isUser) {
                // Already user template, just open
                const doc = await vscode.workspace.openTextDocument(selected.filePath);
                await vscode.window.showTextDocument(doc);
            } else {
                // Built-in template. Ask to create copy.
                const action = await vscode.window.showQuickPick(
                    [
                        { label: vscode.l10n.t('Create User Copy & Edit'), description: vscode.l10n.t('Recommended. Persists after updates.') },
                        { label: vscode.l10n.t('Edit Read-Only Default'), description: vscode.l10n.t('Changes will be lost on update.') }
                    ],
                    { placeHolder: vscode.l10n.t('How do you want to edit this template?') }
                );

                if (action?.label === vscode.l10n.t('Create User Copy & Edit')) {
                    // Create copy
                    const targetDir = path.join(userTemplatesDir, selected.type);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    const targetPath = path.join(targetDir, selected.fileName);
                    fs.copyFileSync(selected.filePath, targetPath);
                    
                    const doc = await vscode.workspace.openTextDocument(targetPath);
                    await vscode.window.showTextDocument(doc);
                } else if (action?.label === vscode.l10n.t('Edit Read-Only Default')) {
                    const doc = await vscode.workspace.openTextDocument(selected.filePath);
                    await vscode.window.showTextDocument(doc);
                }
            }
        }
    }

    public getLocalConfigPath(): string {
        return path.join(os.homedir(), '.qt-any', 'config.json');
    }

    public async openLocalConfig() {
        const configPath = this.getLocalConfigPath();
        // Ensure directory exists if we are going to create file
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        if (!fs.existsSync(configPath)) {
            // Create default config
            const defaultConfig: LocalConfig = {
                fileGroups: {
                    "Example Group": ["/path/to/example/file.h"]
                }
            };
            try {
                fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4));
            } catch (err: any) {
                vscode.window.showErrorMessage(vscode.l10n.t('Failed to create config file: {0}', err.message));
                return;
            }
        }
        
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc);
    }

    public getLocalConfig(): LocalConfig {
        const configPath = this.getLocalConfigPath();
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf-8');
                return JSON.parse(content);
            } catch (err) {
                console.error('Failed to read local config:', err);
            }
        }
        return {};
    }

    public processTemplate(templateContent: string, context: TemplateContext): string {
        let result = templateContent;

        // Handle Project Header (Sub-project support)
        let header = '';
        if (!context.isSubProject) {
            // Read header template
            const headerPath = path.join(this.extensionPath, 'templates', 'header', 'project_header.cmake');
            if (fs.existsSync(headerPath)) {
                let headerTmpl = fs.readFileSync(headerPath, 'utf-8');
                headerTmpl = headerTmpl.replace(/{{CMAKE_MIN_VERSION}}/g, context.cmakeMinVersion);
                headerTmpl = headerTmpl.replace(/{{PROJECT_NAME}}/g, context.projectName);
                
                // Determine languages based on project type
                const languages = context.isC ? 'C' : 'CXX';
                headerTmpl = headerTmpl.replace(/{{LANGUAGES}}/g, languages);
                
                header = headerTmpl;
            } else {
                // Fallback if template missing
                const languages = context.isC ? 'C' : 'CXX';
                header = `cmake_minimum_required(VERSION ${context.cmakeMinVersion})\n\nproject(${context.projectName} LANGUAGES ${languages})`;
            }
        }
        
        result = result.replace(/{{PROJECT_HEADER}}/g, header);
        
        // Handle Standard Settings
        let standardSettings = '';
        if (context.standard) {
            if (context.isC) {
                standardSettings = `set(CMAKE_C_STANDARD ${context.standard})\nset(CMAKE_C_STANDARD_REQUIRED ON)`;
            } else {
                standardSettings = `set(CMAKE_CXX_STANDARD ${context.standard})\nset(CMAKE_CXX_STANDARD_REQUIRED ON)`;
            }
        }
        result = result.replace(/{{STANDARD_SETTINGS}}/g, standardSettings);

        // Standard Replacements

        // Standard Replacements
        result = result.replace(/{{PROJECT_NAME}}/g, context.projectName);
        result = result.replace(/{{PROJECT_NAME_LOWER}}/g, context.projectName.toLowerCase());
        
        if (context.qtMajorVersion) {
            result = result.replace(/{{QT_MAJOR_VERSION}}/g, context.qtMajorVersion);
        }

        if (context.libType) {
            result = result.replace(/{{LIB_TYPE}}/g, context.libType);
        }

        if (context.baseClass) {
            // Needed for Qt templates that might use it (though currently not in the base ones I wrote, 
            // but might be needed for source file generation)
            result = result.replace(/{{BASE_CLASS}}/g, context.baseClass);
        }

        // Export Macro
        const exportMacro = `${context.projectName.toUpperCase()}_EXPORT`;
        result = result.replace(/{{EXPORT_MACRO}}/g, exportMacro);

        return result;
    }
}
