# Qt Any

[English](README.md) | [简体中文](README.zh-CN.md)

Qt Any is a powerful VS Code extension designed to streamline your Qt development workflow. It provides a comprehensive set of tools for creating Qt classes, managing resources, and integrating with external Qt tools.

## Features

- **Create Qt Classes**: Quickly generate Qt-compatible C++ classes with `.h`, `.cpp`, and optional `.ui` files.
- **Visual QRC Editor**: A WYSIWYG editor for Qt Resource files (`.qrc`), supporting add/remove/preview operations.
- **External Tool Integration**: Seamlessly open `.ui` files in Qt Designer and `.ts` files in Qt Linguist.
- **Localization**: Fully localized in English and Simplified Chinese.
- **Create CMake Project**: Quickly create CMake-based Qt projects with necessary file structure and configuration. Supports custom CMakeLists.txt templates.
- **Context Menu Configuration**: Enable/disable context menu items to customize your workflow.
- **Copy Files on Project Creation**: Automatically copy specified files (e.g., `.clang-format`) to the project directory when creating a new project. Supports local file groups to avoid syncing path-specific configurations.

---

## Usage

### 1. Create Qt Classes

Generate standard Qt class boilerplates effortlessly.

- **Command**: `Qt Any: Create Qt Class` (Non-UI) or `Qt Any: Create UI Class`.
- **How to use**:
    1. Right-click on a folder in the File Explorer.
    2. Select **Qt Any: Create Qt Class** (for QObject-based) or **Qt Any: Create UI Class** (for QWidget-based).
    3. Enter the class name (e.g., `MyWidget`).
    4. (Optional) Select the base class (QWidget, QMainWindow, QDialog).
    5. Choose the filename style (lowercase, keep case, or custom).

![Create Qt Class Demo](https://cdn.jsdelivr.net/gh/SyunnT/qt-any@main/doc/create.gif)

### 2. Visual QRC Editor

Manage your Qt resources (`.qrc`) with a user-friendly graphical interface.

- **Open Editor**: Simply click on any `.qrc` file in the File Explorer.
- **Features**:
    - **Add Prefix**: Create new resource prefixes (must start with `/`).
    - **Add Files**: Import files into specific prefixes.
    - **Preview**: Click on any file (images, text) to preview its content in the right panel.
    - **Copy Resource Path**: Right-click on a file node to copy its resource path (e.g., `:/images/logo.png`) to the clipboard.
    - **Edit as XML**: Switch to raw XML editing mode if needed.

![QRC Editor Screenshot](https://cdn.jsdelivr.net/gh/SyunnT/qt-any@main/doc/qrc_edit.gif)
![Right-click Menu](https://cdn.jsdelivr.net/gh/SyunnT/qt-any@main/doc/copy_resource.gif)

### 3. External Tools Integration

Open specific file types in their native Qt editors.

- **Qt Designer**: Right-click on a `.ui` file -> **Qt Any: Open in Qt Designer**.
- **Qt Linguist**: Right-click on a `.ts` file -> **Qt Any: Open in Qt Linguist**.

> **Note**: This requires configuring the `qt-any.qtPath` setting.

![External Tools Demo](https://cdn.jsdelivr.net/gh/SyunnT/qt-any@main/doc/right_open.gif)

### 4. Create Pure C++ Class

For non-Qt specific C++ classes.

- **Command**: `Qt Any: Create C++ Class`.
- **How to use**: Right-click on a folder -> **Qt Any: Create C++ Class** -> Follow the wizard.

### 5. Create CMake Project

Create CMake-based Qt projects.

- **Command**: `Qt Any: Create CMake Project`.
- **How to use**: Right-click on a folder -> **Create CMake Project** -> Follow the wizard.

![Create CMake Project Demo](https://cdn.jsdelivr.net/gh/SyunnT/qt-any@main/doc/create_cmake_project.gif)

### 6. Copy Files on Project Creation

Copy specific files to the project directory when creating a new project.

- **Configuration**: Use **Qt Any: Configure Local File Copying**.
- **How to use**: Open the local configuration, create file groups, and enter the absolute paths of the files to copy. When creating a project, select the file group, and the files will be automatically copied to the project directory (existing files will be overwritten).

![Copy Files Demo](https://cdn.jsdelivr.net/gh/SyunnT/qt-any@main/doc/copy_files.gif)

---

## Configuration

To use external tools (Designer/Linguist), you must configure the path to your Qt installation.

1. Open VS Code Settings (`Ctrl+,`).
2. Search for `qt-any`.
3. Set **Qt Any: Qt Path** to your Qt kit directory (the folder containing `bin`, `include`, `lib`).

**Example**:
- Windows: `C:\Qt\6.5.0\mingw_64`
- macOS: `/Users/username/Qt/6.5.0/macos`
- Linux: `/opt/Qt/6.5.0/gcc_64`

```json
{
    "qt-any.qtPath": "C:\\Qt\\6.5.0\\mingw_64"
}
```

### 2. Configure Context Menu Items

Enable or disable items in the context menu.

- **Configuration**: Settings starting with `qt-any.show...`.
- **How to use**: Open VS Code Settings, search for `qt-any`, and check/uncheck the items you want to display in the context menu.
