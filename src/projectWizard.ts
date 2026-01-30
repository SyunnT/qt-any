import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateManager, TemplateContext } from './templateManager';
import { getHeaderTemplate, getSourceTemplate, getUiTemplate, getGlobalHeaderTemplate, getMainCppTemplate, getMainCTemplate, getCppHeaderTemplate, getCppSourceTemplate } from './templates';

export class ProjectWizard {
    private templateManager: TemplateManager;

    constructor(context: vscode.ExtensionContext) {
        this.templateManager = new TemplateManager(context);
    }

    public async start(uri: vscode.Uri) {
        let targetPath = uri ? uri.fsPath : undefined;

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

        // Check for existing CMakeLists.txt
        if (fs.existsSync(path.join(targetPath, 'CMakeLists.txt'))) {
            vscode.window.showErrorMessage(vscode.l10n.t('CMakeLists.txt already exists in this folder!'));
            return;
        }

        // Step 0: Is Sub-project?
        const isSubProjectSelection = await vscode.window.showQuickPick(
            [vscode.l10n.t('No (Root Project)'), vscode.l10n.t('Yes (Sub-project)')],
            { placeHolder: vscode.l10n.t('Is this a sub-project?') }
        );
        if (!isSubProjectSelection) return;
        const isSubProject = isSubProjectSelection === vscode.l10n.t('Yes (Sub-project)');

        // Step 1: Project Type
        const projectTypes = [
            { label: 'Qt Widget Executable', id: 'qt_widget_exe', isQt: true, isLib: false, isC: false, hasUi: true },
            { label: 'Qt Widget Library', id: 'qt_widget_lib', isQt: true, isLib: true, isC: false, hasUi: true },
            { label: 'Qt Console Executable', id: 'qt_console_exe', isQt: true, isLib: false, isC: false, hasUi: false },
            { label: 'Qt Console Library', id: 'qt_console_lib', isQt: true, isLib: true, isC: false, hasUi: false },
            { label: 'C Executable', id: 'c_exe', isQt: false, isLib: false, isC: true, hasUi: false },
            { label: 'C Library', id: 'c_lib', isQt: false, isLib: true, isC: true, hasUi: false },
            { label: 'C++ Executable', id: 'cpp_exe', isQt: false, isLib: false, isC: false, hasUi: false },
            { label: 'C++ Library', id: 'cpp_lib', isQt: false, isLib: true, isC: false, hasUi: false }
        ];

        const selectedType = await vscode.window.showQuickPick(projectTypes, {
            placeHolder: vscode.l10n.t('Select Project Type')
        });
        if (!selectedType) return;

        // Step 2: Sub-options
        let libType: 'STATIC' | 'SHARED' | undefined;
        if (selectedType.isLib) {
            const libTypeSelection = await vscode.window.showQuickPick(['SHARED', 'STATIC'], {
                placeHolder: vscode.l10n.t('Select Library Type')
            });
            if (!libTypeSelection) return;
            libType = libTypeSelection as 'STATIC' | 'SHARED';
        }

        let baseClass: string | undefined;
        if (selectedType.id.startsWith('qt_widget')) {
            baseClass = await vscode.window.showQuickPick(['QMainWindow', 'QWidget', 'QDialog'], {
                placeHolder: vscode.l10n.t('Select Base Class')
            });
            if (!baseClass) return;
        }

        // Step 3: Versions
        const cmakeVersion = await vscode.window.showQuickPick(['3.5', '3.10', '3.14', '3.16', '3.20'], {
            placeHolder: vscode.l10n.t('Select Minimum CMake Version')
        });
        if (!cmakeVersion) return;

        let qtVersion: string | undefined;
        if (selectedType.isQt) {
            qtVersion = await vscode.window.showQuickPick(['5', '6'], {
                placeHolder: vscode.l10n.t('Select Qt Major Version')
            });
            if (!qtVersion) return;
        }

        // Step 3.1: Standard Selection
        let standard: string | undefined;
        const standards = selectedType.isC 
            ? ['99', '11', '17'] 
            : ['11', '14', '17', '20', '23'];
        
        standard = await vscode.window.showQuickPick(standards, {
            placeHolder: vscode.l10n.t('Select Language Standard (C/C++)')
        });
        if (!standard) return;

        // Step 4: Project Name
        const defaultName = path.basename(targetPath);
        const projectName = await vscode.window.showInputBox({
            prompt: vscode.l10n.t('Enter Project Name'),
            placeHolder: defaultName,
            value: defaultName,
            validateInput: (text) => {
                if (!text || text.trim().length === 0) return vscode.l10n.t('Name cannot be empty');
                if (!/^[a-zA-Z0-9_]+$/.test(text)) return vscode.l10n.t('Invalid name (alphanumeric and underscore only)');
                return null;
            }
        });
        if (!projectName) return;

        // Step 5: File Copy Group
        const localConfig = this.templateManager.getLocalConfig();
        const fileGroups = localConfig.fileGroups ? Object.keys(localConfig.fileGroups) : [];
        const copyOptions = [vscode.l10n.t('(None)'), ...fileGroups];
        
        const selectedGroup = await vscode.window.showQuickPick(copyOptions, {
            placeHolder: vscode.l10n.t('Select File Copy Group')
        });
        if (!selectedGroup) return;

        // Generate
        try {
            const context: TemplateContext = {
                projectName: projectName,
                cmakeMinVersion: cmakeVersion,
                qtMajorVersion: qtVersion,
                libType: libType,
                baseClass: baseClass,
                isSubProject: isSubProject,
                standard: standard,
                isC: selectedType.isC
            };

            await this.generateProject(targetPath, selectedType.id, context, selectedType);

            // Copy Files
            if (selectedGroup !== vscode.l10n.t('(None)') && localConfig.fileGroups && localConfig.fileGroups[selectedGroup]) {
                const filesToCopy = localConfig.fileGroups[selectedGroup];
                for (const file of filesToCopy) {
                    if (fs.existsSync(file)) {
                        const dest = path.join(targetPath, path.basename(file));
                        fs.copyFileSync(file, dest);
                    } else {
                        vscode.window.showWarningMessage(vscode.l10n.t('File not found: {0}', file));
                    }
                }
            }

            vscode.window.showInformationMessage(vscode.l10n.t('Project "{0}" created successfully!', projectName));
            
            // Open CMakeLists.txt
            const cmakePath = path.join(targetPath, 'CMakeLists.txt');
            const doc = await vscode.workspace.openTextDocument(cmakePath);
            await vscode.window.showTextDocument(doc);

        } catch (err: any) {
            vscode.window.showErrorMessage(vscode.l10n.t('Error creating project: {0}', err.message));
        }
    }

    private async generateProject(targetPath: string, typeId: string, context: TemplateContext, typeInfo: any) {
        // Read CMake Template
        const templatePath = this.templateManager.getTemplatePath(`${typeId}.cmake`);
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${typeId}.cmake`);
        }
        
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        const finalCmakeContent = this.templateManager.processTemplate(templateContent, context);
        
        fs.writeFileSync(path.join(targetPath, 'CMakeLists.txt'), finalCmakeContent);

        // Generate Source Files
        const projectName = context.projectName;
        
        // Export Macro
        const exportMacro = `${projectName.toUpperCase()}_EXPORT`;

        if (typeInfo.isC) {
            // C Projects
            if (typeInfo.isLib) {
                // C Lib
                fs.writeFileSync(path.join(targetPath, `${projectName}_global.h`), getGlobalHeaderTemplate(projectName, exportMacro));
                // Basic C files
                fs.writeFileSync(path.join(targetPath, `${projectName}.h`), `#ifndef ${projectName.toUpperCase()}_H\n#define ${projectName.toUpperCase()}_H\n\n#include "${projectName}_global.h"\n\n${exportMacro} void hello();\n\n#endif\n`);
                fs.writeFileSync(path.join(targetPath, `${projectName}.c`), `#include "${projectName}.h"\n#include <stdio.h>\n\nvoid hello() {\n    printf("Hello from ${projectName}!\\n");\n}\n`);
            } else {
                // C Exe
                fs.writeFileSync(path.join(targetPath, 'main.c'), getMainCTemplate());
            }
        } else {
            // C++ / Qt Projects
            if (typeInfo.isLib) {
                // Library
                fs.writeFileSync(path.join(targetPath, `${projectName}_global.h`), getGlobalHeaderTemplate(projectName, exportMacro));
                
                if (typeInfo.id === 'cpp_lib') {
                    // C++ Library (Standard, no Qt inheritance)
                    const headerGuard = `${projectName.toUpperCase()}_H`;
                    const libHeader = `#ifndef ${headerGuard}
#define ${headerGuard}

#include "${projectName}_global.h"

class ${exportMacro} ${projectName}
{
public:
    ${projectName}();
};

#endif // ${headerGuard}
`;
                    const libSource = `#include "${projectName}.h"

${projectName}::${projectName}()
{
}
`;
                    fs.writeFileSync(path.join(targetPath, `${projectName}.h`), libHeader);
                    fs.writeFileSync(path.join(targetPath, `${projectName}.cpp`), libSource);
                } else {
                    // Qt Library (Widget or Console) - Should inherit correctly
                    const hasUi = typeInfo.hasUi; // true for widget_lib
                    // Widget lib has baseClass (QWidget/QMainWindow...), Console default to QObject
                    const baseClass = context.baseClass || 'QObject';
                    
                    let headerContent = getHeaderTemplate(projectName, baseClass, hasUi);
                    // Inject Global Header
                    headerContent = headerContent.replace(/(#include <.*>)/, `$1\n#include "${projectName}_global.h"`);
                    // Inject Export Macro
                    // Match "class ClassName :" to ensure we don't match "namespace Ui { class ClassName; }"
                    headerContent = headerContent.replace(new RegExp(`class\\s+${projectName}\\s*:`), `class ${exportMacro} ${projectName} :`);
                    
                    fs.writeFileSync(path.join(targetPath, `${projectName}.h`), headerContent);
                    fs.writeFileSync(path.join(targetPath, `${projectName}.cpp`), getSourceTemplate(projectName, baseClass, hasUi, projectName));
                    
                    if (hasUi) {
                        fs.writeFileSync(path.join(targetPath, `${projectName}.ui`), getUiTemplate(projectName, baseClass));
                    }
                }

            } else {
                // Executable
                if (typeInfo.id === 'qt_widget_exe') {
                    // Main.cpp
                    // Use ProjectName as ClassName and FileName
                    const baseClass = context.baseClass || 'QMainWindow';
                    
                    fs.writeFileSync(path.join(targetPath, 'main.cpp'), getMainCppTemplate(true, true, `${projectName}.h`, projectName));
                    
                    fs.writeFileSync(path.join(targetPath, `${projectName}.h`), getHeaderTemplate(projectName, baseClass, true));
                    fs.writeFileSync(path.join(targetPath, `${projectName}.cpp`), getSourceTemplate(projectName, baseClass, true, projectName));
                    fs.writeFileSync(path.join(targetPath, `${projectName}.ui`), getUiTemplate(projectName, baseClass));

                } else if (typeInfo.id === 'qt_console_exe') {
                    // Use ProjectName as ClassName and FileName
                    const baseClass = 'QObject'; // Console apps usually inherit QObject for signal/slot
                    
                    fs.writeFileSync(path.join(targetPath, 'main.cpp'), getMainCppTemplate(true, false, `${projectName}.h`, projectName));
                    
                    fs.writeFileSync(path.join(targetPath, `${projectName}.h`), getHeaderTemplate(projectName, baseClass, false));
                    fs.writeFileSync(path.join(targetPath, `${projectName}.cpp`), getSourceTemplate(projectName, baseClass, false, projectName));
                } else {
                    // C++ Exe
                    fs.writeFileSync(path.join(targetPath, 'main.cpp'), getMainCppTemplate(false, false));
                }
            }
        }
    }
}
