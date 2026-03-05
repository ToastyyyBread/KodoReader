const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;
const isDev = !app.isPackaged;

function getAppRoot() {
    if (isDev) return __dirname;
    // Packaged: process.resourcesPath = <install_dir>/resources
    return path.dirname(process.resourcesPath);
}

// ── IPC: native folder dialog ─────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select a Manga Folder'
    });
    if (result.canceled) return '';
    return result.filePaths[0] || '';
});

// Helper to find an open port dynamically
function getFreePort() {
    return new Promise((resolve) => {
        const srv = http.createServer();
        srv.listen(0, () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

function startServer() {
    return new Promise(async (resolve, reject) => {
        const port = await getFreePort();
        const serverPath = path.join(__dirname, 'server', 'index.js');

        process.env.KODO_APP_ROOT = getAppRoot();
        process.env.KODO_IS_PACKAGED = app.isPackaged ? '1' : '0';
        process.env.PORT = port; // Override port to the free port

        console.log('[Kodo] App root:', process.env.KODO_APP_ROOT);
        console.log('[Kodo] Server path:', serverPath);
        console.log('[Kodo] Dynamic Port:', port);

        try {
            require(serverPath); // Starts express on dynamic port

            // Poll until server is responding
            const checkReady = () => {
                http.get(`http://localhost:${port}/api/categories`, (res) => {
                    console.log('[Kodo] Server is ready implicitly at', port);
                    resolve(port);
                }).on('error', () => {
                    setTimeout(checkReady, 300);
                });
            };
            setTimeout(checkReady, 200);
        } catch (err) {
            console.error('[Kodo] ERROR starting server:', err);
            reject(err);
        }
    });
}

function createWindow(port) {
    const preloadPath = isDev
        ? path.join(__dirname, 'preload.js')
        : path.join(process.resourcesPath, 'app', 'preload.js');

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Kodo',
        icon: path.join(__dirname, 'assets', 'kodo_500.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath
        },
        autoHideMenuBar: true,
        show: false
    });

    const targetUrl = `http://localhost:${port}`;
    console.log('[Kodo] Loading UI at:', targetUrl);
    mainWindow.loadURL(targetUrl);

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) mainWindow.show();
    });

    mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
        console.error(`[Kodo] Page load failed: ${desc}`);
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL(targetUrl);
            }
        }, 1500);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    try {
        const activePort = await startServer();
        createWindow(activePort);
    } catch (err) {
        console.error('[Kodo] Critical startup failure:', err);
    }
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        // Fallback to 5000 if restarted from dock with no active instance?
        createWindow(process.env.PORT || 5000);
    }
});
