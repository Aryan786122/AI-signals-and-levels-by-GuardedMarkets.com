const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  Tray,
  Menu,
  Notification,
  nativeImage,
  screen,
  globalShortcut,
} = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Ensure Windows DWM never suspends or occludes the transparent assistant window
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let localServer = null;
let localPort = null;
let currentAppUrl = null;
let isTeachingModeActive = false;
let isInteractionModeLocked = false;
let captureInterval = null;

// Helper to check if a local URL is active
function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start embedded Next.js production server for standalone execution
async function startInternalServer() {
  const next = require('next');
  const appDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.resolve(__dirname, '..');

  process.env.NODE_ENV = 'production';

  if (!process.env.DATABASE_URL) {
    let dbFile;
    if (app.isPackaged) {
      const userDbDir = path.join(app.getPath('userData'), 'database');
      if (!fs.existsSync(userDbDir)) {
        fs.mkdirSync(userDbDir, { recursive: true });
      }
      dbFile = path.join(userDbDir, 'dev.db');
      const seedDb = path.join(appDir, 'prisma', 'dev.db');
      if (fs.existsSync(seedDb)) {
        if (!fs.existsSync(dbFile) || fs.statSync(seedDb).mtimeMs > (fs.existsSync(dbFile) ? fs.statSync(dbFile).mtimeMs : 0)) {
          try {
            fs.copyFileSync(seedDb, dbFile);
            console.log('[TradingAI Desktop] Synced latest database schema to userData');
          } catch (e) {
            console.warn('[TradingAI Desktop] DB copy error:', e);
          }
        }
      }
    } else {
      dbFile = path.resolve(appDir, 'prisma', 'dev.db');
    }
    process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, '/')}`;
  }

  const nextApp = next({
    dev: false,
    dir: appDir,
    conf: { distDir: '.next' },
  });

  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => handle(req, res));
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      localPort = address.port;
      localServer = server;
      console.log(`[TradingAI Desktop] Internal production engine running on http://127.0.0.1:${localPort}`);
      resolve(localPort);
    });
    server.on('error', reject);
  });
}

async function getAppUrl() {
  if (currentAppUrl) return currentAppUrl;

  if (process.env.ELECTRON_START_URL) {
    currentAppUrl = process.env.ELECTRON_START_URL;
    return currentAppUrl;
  }

  if (!app.isPackaged) {
    for (const port of [3002, 3000, 3001]) {
      const isRunning = await checkUrl(`http://127.0.0.1:${port}`);
      if (isRunning) {
        console.log(`[TradingAI Desktop] Connecting to active server on http://127.0.0.1:${port}`);
        currentAppUrl = `http://127.0.0.1:${port}`;
        return currentAppUrl;
      }
    }
  }

  console.log('[TradingAI Desktop] Starting embedded local Next.js production engine...');
  const port = await startInternalServer();
  currentAppUrl = `http://127.0.0.1:${port}`;
  return currentAppUrl;
}

// 1. Teacher Workstation Main Window
async function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const appUrl = await getAppUrl();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#090B0F',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: 'Trading AI — Teacher Workstation & Knowledge Center',
  });

  mainWindow.loadURL(appUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 2. Dedicated Widget-Sized Persistent Desktop Assistant Window
async function createOverlayWindow() {
  const appUrl = await getAppUrl();

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = primaryDisplay.workArea;

  const windowWidth = 460;
  const windowHeight = 640;
  const initialX = Math.max(screenX, Math.round(screenX + screenWidth - windowWidth - 24));
  const initialY = Math.max(screenY, Math.round(screenY + Math.max(24, (screenHeight - windowHeight) / 2)));

  overlayWindow = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: windowWidth,
    height: windowHeight,
    minWidth: 380,
    minHeight: 480,
    maxWidth: 700,
    maxHeight: 900,
    frame: false,
    transparent: false,
    backgroundColor: '#090B0F',
    hasShadow: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    skipTaskbar: false,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: 'Guarded AI Assistant',
  });

  // Windows-safe system-level topmost configuration
  overlayWindow.setAlwaysOnTop(true, 'floating', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true);

  // Re-assert topmost on blur so Windows DWM doesn't drop z-order when other apps are clicked
  // Note: We do NOT steal focus. We only re-affirm topmost z-order.
  overlayWindow.on('blur', () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      overlayWindow.setAlwaysOnTop(true, 'floating', 1);
    }
  });

  overlayWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[TradingAI Desktop] Overlay failed to load: ${errorDescription} (${errorCode}) at ${validatedURL}`);
  });

  overlayWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[TradingAI Desktop] Overlay renderer process crashed/gone:', details);
  });

  overlayWindow.loadURL(`${appUrl}/overlay`);

  const showOverlayWindow = () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.isVisible()) {
      overlayWindow.show();
      overlayWindow.setAlwaysOnTop(true, 'floating', 1);
      console.log('[TradingAI Desktop] Assistant floating window is now SHOWN on screen');
      startDesktopCaptureLoop();
    }
  };

  overlayWindow.once('ready-to-show', showOverlayWindow);
  overlayWindow.webContents.once('did-finish-load', showOverlayWindow);
  setTimeout(showOverlayWindow, 1500);

  overlayWindow.on('closed', () => {
    console.log('[TradingAI Desktop] Overlay window closed');
    overlayWindow = null;
    stopDesktopCaptureLoop();
  });
}

function toggleOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
  } else if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.show();
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  }
}

function toggleTeachingMode() {
  isTeachingModeActive = !isTeachingModeActive;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('teaching-mode-toggle', {
      isTeachingMode: isTeachingModeActive,
    });
  }
  if (Notification.isSupported()) {
    new Notification({
      title: isTeachingModeActive ? '● Teaching Mode Started' : 'Teaching Mode Stopped',
      body: isTeachingModeActive
        ? 'Speak, point, and draw over the screen to teach the AI.'
        : 'Session recorded and saved to candidate knowledge.',
    }).show();
  }
}

function toggleInteractionMode() {
  isInteractionModeLocked = !isInteractionModeLocked;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('interaction-mode-toggle', {
      isInteractionModeLocked,
    });
  }
}

function toggleHudVisibility() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('hud-visibility-toggle');
  }
}

// 3. Background Desktop Screen Capture Loop
function startDesktopCaptureLoop() {
  if (captureInterval) clearInterval(captureInterval);

  captureInterval = setInterval(async () => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 640, height: 360 },
      });

      if (sources.length > 0) {
        const base64Thumbnail = sources[0].thumbnail.toDataURL();
        const appUrl = await getAppUrl();

        // Send to local perception endpoint
        const req = http.request(
          `${appUrl}/api/screen/perceive`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.reasoning && overlayWindow && !overlayWindow.isDestroyed()) {
                  overlayWindow.webContents.send('screen-perception-update', {
                    observation: parsed.observation,
                    reasoning: parsed.reasoning,
                  });
                }
              } catch {}
            });
          }
        );

        req.on('error', () => {});
        req.write(JSON.stringify({ imageBase64: base64Thumbnail }));
        req.end();
      }
    } catch (err) {
      console.warn('[TradingAI Desktop] Background capture error:', err);
    }
  }, 3000);
}

function stopDesktopCaptureLoop() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
}

// 4. System Tray
function createTray() {
  try {
    const icon = nativeImage.createFromBuffer(
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xf3, 0xff, 0x61, 0x00, 0x00, 0x00,
        0x19, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x18, 0x05, 0xa3,
        0x60, 0x14, 0x8c, 0x82, 0x10, 0x18, 0x04, 0x00, 0x00, 0xff, 0xff, 0x03,
        0x00, 0x0d, 0x0a, 0x01, 0x68, 0xbd, 0x1b, 0xbf, 0x5a, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ])
    );
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '● Trading AI Active',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Toggle Screen Overlay (Ctrl+Shift+A)',
        click: () => toggleOverlay(),
      },
      {
        label: 'Toggle Teaching Mode (Ctrl+Shift+T)',
        click: () => toggleTeachingMode(),
      },
      {
        label: 'Toggle Pass-Through (Ctrl+Shift+I)',
        click: () => toggleInteractionMode(),
      },
      { type: 'separator' },
      {
        label: 'Open Teacher Workstation',
        click: () => createMainWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit Trading AI',
        click: () => app.quit(),
      },
    ]);
    tray.setToolTip('Trading AI — Desktop Screen Overlay & Student');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => toggleOverlay());
  } catch (err) {
    console.warn('[TradingAI Desktop] Could not create system tray:', err);
  }
}

app.whenReady().then(() => {
  createTray();
  createOverlayWindow();

  // Register Global System Hotkeys
  globalShortcut.register('CommandOrControl+Shift+A', () => toggleOverlay());
  globalShortcut.register('CommandOrControl+Shift+T', () => toggleTeachingMode());
  globalShortcut.register('CommandOrControl+Shift+I', () => toggleInteractionMode());
  globalShortcut.register('CommandOrControl+Shift+H', () => toggleHudVisibility());

  // IPC Handlers
  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }));
  });

  ipcMain.handle('get-display-bounds', () => {
    const primary = screen.getPrimaryDisplay();
    return primary.bounds;
  });

  // Dedicated widget-sized assistant window is always interactive
  ipcMain.on('set-overlay-interactive', () => {
    // No-op: Assistant window is widget-sized and interactive by default
  });

  ipcMain.on('set-overlay-click-through', () => {
    // No-op: Assistant window is widget-sized and interactive by default
  });

  ipcMain.on('open-overlay', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      createOverlayWindow();
    } else {
      overlayWindow.show();
      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  ipcMain.on('close-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
  });

  ipcMain.on('hide-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
  });

  ipcMain.on('toggle-overlay', () => {
    toggleOverlay();
  });

  ipcMain.on('toggle-teaching-mode', () => {
    toggleTeachingMode();
  });

  ipcMain.on('open-main-window', (event, { route = '/' } = {}) => {
    createMainWindow();
    if (mainWindow && !mainWindow.isDestroyed() && currentAppUrl) {
      mainWindow.loadURL(`${currentAppUrl}${route}`);
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  ipcMain.handle('get-system-info', () => ({
    isElectron: true,
    version: app.getVersion(),
    arch: process.arch,
    platform: process.platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
  }));

  app.on('activate', () => {
    if (!overlayWindow) createOverlayWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopDesktopCaptureLoop();
  if (localServer) {
    try {
      localServer.close();
    } catch {}
  }
});

// Global error logging
process.on('uncaughtException', (err) => {
  console.error('[TradingAI Desktop] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[TradingAI Desktop] Unhandled rejection:', reason);
});

app.on('window-all-closed', () => {
  // Keep app active in background system tray (do not exit)
});
