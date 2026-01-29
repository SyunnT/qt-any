# Qt Class Creator

This extension provides a convenient way to create Qt classes and open `.ui` files in Qt Designer directly from your editor.

## Features

- **Create Qt Class (Non-UI)**: Generates `.h` and `.cpp` files with a basic `QObject` based class structure.
- **Create Qt UI Class**: Generates `.h`, `.cpp`, and `.ui` files with a `QWidget` based class structure and proper UI setup code.
- **Open in Qt Designer**: Right-click on any `.ui` file in the Explorer and select "Open in Qt Designer".

## Usage

### Creating Classes

1. Right-click on a folder in the Explorer.
2. Select **Qt: Create Class (Non-UI)** or **Qt: Create UI Class**.
3. Enter the class name (e.g., `MyWidget`).
4. The extension will generate the files (e.g., `mywidget.h`, `mywidget.cpp`, `mywidget.ui`) and open the header file.

Alternatively, use the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type `Qt: Create Class`.

### Opening Qt Designer

1. Right-click on a `.ui` file in the Explorer.
2. Select **Open in Qt Designer**.

**Note**: You need to configure the path to your Qt Designer executable first.

## Configuration

Go to **Settings** -> **Extensions** -> **Qt Any** and set the **Designer Path**.

Or add this to your `settings.json`:

```json
{
    "qt-any.designerPath": "C:\\Qt\\6.x.x\\mingw_64\\bin\\designer.exe"
}
```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Compile the extension:
   ```bash
   npm run compile
   ```
3. Press `F5` to start debugging in a new Extension Development Host window.
