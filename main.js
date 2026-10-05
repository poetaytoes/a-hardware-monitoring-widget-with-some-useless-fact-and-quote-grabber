const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');

// Import and start your Express orchestrator server automatically
require('./server.js');

let mainWindow = null;
let widgetWindow = null;
let tray = null;

// Create the Full Feature Dashboard Window
function createMainWindow() {
    if (mainWindow) {
        mainWindow.focus();
        return;
    }
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#0f172a',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
        autoHideMenuBar: true
    });
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.on('closed', () => { mainWindow = null; });
}

// Create the Compact Floating Desktop Widget Window (Always on Top, Frameless)
function createWidgetWindow() {
    if (widgetWindow) {
        widgetWindow.focus();
        return;
    }
    widgetWindow = new BrowserWindow({
        width: 260,
        height: 170,
        frame: false,            // No standard window borders
        transparent: true,       // Glassmorphism effect
        alwaysOnTop: true,       // Initial flag
        resizable: false,
        skipTaskbar: true,       // Keeps the taskbar clean
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    // FORCE IT ABOVE FULLSCREEN GAMES & HEAVY WORKLOADS:
    // 'screen-saver' gives it high priority over DirectX/Vulkan windows
    widgetWindow.setAlwaysOnTop(true, 'screen-saver');
    
    // Ensures the widget stays visible even when full-screen apps are active
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    widgetWindow.loadFile(path.join(__dirname, 'public', 'widget.html'));
    widgetWindow.on('closed', () => { widgetWindow = null; });
}

app.whenReady().then(() => {
    // Setup System Tray Icon & Menu
    const iconPath = path.join(__dirname, 'public', 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);

    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Full Dashboard', click: createMainWindow },
        { label: 'Toggle Desktop Widget (Always on Top)', click: () => {
            if (widgetWindow) widgetWindow.close();
            else createWidgetWindow();
        }},
        { type: 'separator' },
        { label: 'Quit App', click: () => {
            app.isQuiting = true;
            app.quit();
        }}
    ]);

    tray.setToolTip('Polyglot System Utility: Initializing...');
    tray.setContextMenu(contextMenu);
    tray.on('click', createMainWindow);

    // Automatically launch the compact floating widget on startup
    createWidgetWindow();
});

// Update Tray Tooltip dynamically when receiving stats from the widget loop
ipcMain.on('update-tray-stats', (event, stats) => {
    if (tray && stats) {
        tray.setToolTip(`CPU: ${stats.cpu}% | GPU: ${stats.gpu}%`);
    }
});

app.on('window-all-closed', (e) => {
    // Keep app running in the background system tray even if windows are closed
    if (!app.isQuiting) {
        e.preventDefault();
    }
});