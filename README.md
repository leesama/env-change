# Env Switch - Chrome Extension

[中文文档](./README_zh.md)

A Chrome browser extension that helps developers quickly switch between different development/testing environments with automatic form filling.

## ✨ Features

- **Multi-Environment Management** - Create and manage multiple environment configs (dev, test, staging, etc.)
- **Auto Form Filling** - Configure username, password and other fields for automatic filling
- **Auto Login** - Optionally configure login button for automatic click after form fill
- **Draggable Panel** - Both the floating panel and collapsed toggle button can be freely dragged
- **Domain Filtering** - Configure to show panel only on specified domains
- **Import/Export** - Backup and migrate your configurations

## 📦 Installation

### From Release

1. Go to [Releases](../../releases) and download the latest `env-change-extension.zip`
2. Extract to a local directory
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked" and select the extracted `dist` folder

### Build from Source

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Output is in dist directory
```

## 🚀 Usage Guide

### Create Environment

1. Click "+ New Environment" in the floating panel on the right side
2. Enter environment name (e.g., Development)
3. Enter login page URL (required)
4. Configure login fields:
   - Click the selector button, then click the input field on the page
   - Enter the value to auto-fill
5. Optional: Configure login button for auto-click
6. Click "Save"

### Switch Environment

Click an environment name in the panel to switch:
- Clears localStorage of current page
- Navigates to the environment's login page
- Auto-fills form and clicks login (if configured)

### Domain Filtering

1. Click the extension icon in browser toolbar
2. Configure "Allowed Domains" (one per line):
   - `example.com` - Exact match
   - `*.example.com` - Match all subdomains
3. Leave empty to show on all pages

### Import/Export

- **Export**: Click "📤 Export" to download JSON file
- **Import**: Click "📥 Import" to select JSON file, page auto-refreshes

## 🛠 Tech Stack

- React 18
- TypeScript
- Vite
- Chrome Extension Manifest V3

## 📁 Project Structure

```
src/
├── content/          # Content Script (floating panel injected into pages)
│   ├── views/        # React components
│   ├── selector.ts   # Element selector logic
│   └── switcher.ts   # Environment switching logic
├── popup/            # Popup page (extension settings)
├── sidepanel/        # Side Panel (reserved)
├── storage.ts        # Configuration storage
└── types.ts          # TypeScript type definitions
```

## 📝 Development

```bash
# Install dependencies
pnpm install

# Development mode (watch files)
pnpm run dev

# Build for production
pnpm run build
```

## 📄 License

MIT
