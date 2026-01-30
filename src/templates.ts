
export function getHeaderTemplate(className: string, baseClass: string = 'QObject', hasUi: boolean = false): string {
    const includeGuard = `${className.toUpperCase()}_H`;
    
    let includes = '';
    if (hasUi) {
        includes = `#include <${baseClass}>\n`;
    } else {
        includes = `#include <QObject>\n`;
    }

    let namespaceDecl = '';
    let uiMember = '';
    
    if (hasUi) {
        namespaceDecl = `\nQT_BEGIN_NAMESPACE\nnamespace Ui { class ${className}; }\nQT_END_NAMESPACE\n`;
        uiMember = `\n\nprivate:\n    Ui::${className} *ui;`;
    }

    const parentType = hasUi ? 'QWidget' : 'QObject';
    const constructor = `    explicit ${className}(${parentType} *parent = nullptr);`;
    const destructor = `    ~${className}() override;`;
    
    const inherit = `public ${baseClass}`;

    return `#ifndef ${includeGuard}
#define ${includeGuard}

${includes}${namespaceDecl}
class ${className} : ${inherit}
{
    Q_OBJECT

public:
${constructor}
${destructor}${uiMember}
};

#endif // ${includeGuard}
`;
}

export function getSourceTemplate(className: string, baseClass: string = 'QObject', hasUi: boolean = false, headerFileName: string = ''): string {
    const uiInit = hasUi ? `\n    , ui(new Ui::${className})` : '';
    const uiSetup = hasUi ? `\n    ui->setupUi(this);` : '';
    const uiDelete = hasUi ? `\n    delete ui;` : '';
    const parentType = hasUi ? 'QWidget' : 'QObject';
    
    // For non-UI classes, baseClass is QObject. For UI classes, it's whatever is passed.
    // However, the constructor usually calls the base class constructor.
    const baseConstructor = hasUi ? `${baseClass}(parent)` : `QObject(parent)`;

    // Use provided headerFileName or fallback to lowercase logic (backward compatibility)
    const headerName = headerFileName ? headerFileName : className.toLowerCase();

    return `#include "${headerName}.h"
${hasUi ? `#include "ui_${headerName}.h"\n` : ''}
${className}::${className}(${parentType} *parent)
    : ${baseConstructor}${uiInit}
{${uiSetup}
}

${className}::~${className}()
{${uiDelete}
}
`;
}

export function getUiTemplate(className: string, baseClass: string = 'QWidget'): string {
    let widgets = '';
    if (baseClass === 'QMainWindow') {
        widgets = `
  <widget class="QWidget" name="centralwidget"/>
  <widget class="QMenuBar" name="menubar"/>
  <widget class="QStatusBar" name="statusbar"/>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<ui version="4.0">
 <class>${className}</class>
 <widget class="${baseClass}" name="${className}">
  <property name="geometry">
   <rect>
    <x>0</x>
    <y>0</y>
    <width>400</width>
    <height>300</height>
   </rect>
  </property>
  <property name="windowTitle">
   <string>${className}</string>
  </property>${widgets}
 </widget>
 <resources/>
 <connections/>
</ui>
`;
}

export function getQrcTemplate(): string {
    return `<!DOCTYPE RCC>
<RCC version="1.0">
    <qresource prefix="/">
    </qresource>
</RCC>
`;
}

export function getCppHeaderTemplate(className: string): string {
    const includeGuard = `${className.toUpperCase()}_H`;
    
    return `#ifndef ${includeGuard}
#define ${includeGuard}

class ${className}
{
public:
    ${className}();
    ~${className}();
};

#endif // ${includeGuard}
`;
}

export function getCppSourceTemplate(className: string, headerFileName: string = ''): string {
    const headerName = headerFileName ? headerFileName : className.toLowerCase();

    return `#include "${headerName}.h"

${className}::${className}()
{
}

${className}::~${className}()
{
}
`;
}

export function getGlobalHeaderTemplate(projectName: string, exportMacro: string): string {
    const includeGuard = `${projectName.toUpperCase()}_GLOBAL_H`;
    return `#ifndef ${includeGuard}
#define ${includeGuard}

#include <QtCore/qglobal.h>

#ifdef ${projectName.toUpperCase()}_LIBRARY
#define ${exportMacro} Q_DECL_EXPORT
#else
#define ${exportMacro} Q_DECL_IMPORT
#endif

#endif // ${includeGuard}
`;
}

export function getMainCppTemplate(isQt: boolean, hasUi: boolean, includeFile: string = '', className: string = ''): string {
    if (isQt && hasUi) {
        return `#include <QApplication>
#include "${includeFile}"

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    ${className} w;
    w.show();
    return a.exec();
}
`;
    } else if (isQt) { // Qt Console
        return `#include <QCoreApplication>
#include "${includeFile}"

int main(int argc, char *argv[])
{
    QCoreApplication a(argc, argv);
    ${className} c;

    return a.exec();
}
`;
    } else { // Standard C++
        return `#include <iostream>

int main()
{
    std::cout << "Hello World!" << std::endl;
    return 0;
}
`;
    }
}

export function getMainCTemplate(): string {
    return `#include <stdio.h>

int main()
{
    printf("Hello World!\\n");
    return 0;
}
`;
}
