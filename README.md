# Qt Any

This extension provides a convenient way to create Qt classes, open `.ui` files in Qt Designer, and open `.ts` files in Qt Linguist directly from your editor.

## Features

- **Create Qt Class (Non-UI)**: Generates `.h` and `.cpp` files with a basic `QObject` based class structure.
- **Create Qt UI Class**: Generates `.h`, `.cpp`, and `.ui` files with a `QWidget` based class structure and proper UI setup code.
- **Open in Qt Designer**: Right-click on any `.ui` file in the Explorer and select "Qt Any: Open in Qt Designer".
- **Open in Qt Linguist**: Right-click on any `.ts` file in the Explorer and select "Qt Any: Open in Qt Linguist".

## Usage

### Creating Classes

1. Right-click on a folder in the Explorer.
2. Select **Qt Any: Create Class (Non-UI)** or **Qt Any: Create UI Class**.
3. Enter the class name (e.g., `MyWidget`).
4. The extension will generate the files (e.g., `mywidget.h`, `mywidget.cpp`, `mywidget.ui`) and open the header file.

Alternatively, use the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type `Qt Any: Create Class`.

### Opening Qt Tools

- **Qt Designer**: Right-click on a `.ui` file and select **Qt Any: Open in Qt Designer**.
- **Qt Linguist**: Right-click on a `.ts` file and select **Qt Any: Open in Qt Linguist**.

**Note**: You need to configure the path to your Qt installation root directory first.

## Configuration

Go to **Settings** -> **Extensions** -> **Qt Any** and set the **Qt Path**.

Or add this to your `settings.json`:

```json
{
    "qt-any.qtPath": "C:\\Qt\\6.5.0\\mingw_64"
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
