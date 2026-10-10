const { app, BrowserWindow, Menu, ipcMain, Notification } = require("electron");
const path = require("path");
const moment = require("moment");
const functions = require("../functions");
const { loadConfig, saveConfig } = require("./config");
const { setupTray } = require("./tray");
const { initScanner, startSearchTask, stopSearchTask, getScannerState } = require("./scanner");
const { validateSearchCriteria } = require("./validator");

let mainWindow = null;
let isQuitting = false;

function sendLog(type, message) {
  const time = moment().format("HH:mm:ss");
  const logItem = { time, type, message };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log-message", logItem);
  }
}

function sendStatusUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const state = getScannerState();
    mainWindow.webContents.send("status-update", state);
  }
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title,
      body,
      silent: false,
    });
    notif.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notif.show();
  }
}

function createMainWindow() {
  const appIconPath = path.join(__dirname, "assets", "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    icon: appIconPath,
    frame: true,
    backgroundColor: "#f5f7fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: true,
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// IPC Kanalları
ipcMain.handle("get-config", () => loadConfig());
ipcMain.handle("save-config", (_event, data) => saveConfig(data));

ipcMain.handle("validate-token", async (_event, token) => {
  try {
    const res = await functions.kullaniciRandevulari(token);
    let expiresAt = null;
    try {
      const parts = token.replace("Bearer ", "").trim().split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
        if (payload.exp) {
          expiresAt = payload.exp * 1000;
        }
      }
    } catch (_) {}

    return { success: true, count: res?.length || 0, expiresAt };
  } catch (e) {
    return {
      success: false,
      error: e.response?.data?.errors?.[0]?.mesaj || e.message,
    };
  }
});

ipcMain.handle("load-cities", async () => {
  const cfg = loadConfig();
  if (!cfg.token) throw new Error("Önce token giriniz.");
  return await functions.illeriAl(cfg.token);
});

ipcMain.handle("load-districts", async (_event, plaka) => {
  const cfg = loadConfig();
  if (!cfg.token) throw new Error("Önce token giriniz.");
  return await functions.ilinIlceleri(cfg.token, plaka);
});

ipcMain.handle("load-clinics", async (_event, { plaka, ilceId }) => {
  const cfg = loadConfig();
  if (!cfg.token) throw new Error("Önce token giriniz.");
  return await functions.klinikleriAl(cfg.token, plaka, ilceId || -1);
});

ipcMain.handle("start-search", (_event, criteria) => {
  const validation = validateSearchCriteria(criteria);
  if (!validation.valid) {
    sendLog("error", `Doğrulama Hatası: ${validation.error}`);
    return { success: false, error: validation.error };
  }
  return startSearchTask(criteria);
});

ipcMain.handle("stop-search", () => stopSearchTask());

ipcMain.on("minimize-window", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("close-window", () => {
  if (mainWindow) mainWindow.hide();
});

// Uygulama Yaşam Döngüsü
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.mhrs.otorandevu");

    initScanner({
      sendLog,
      sendStatusUpdate,
      showNotification,
      onAppointmentBooked: (appt) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("appointment-booked", appt);
        }
      },
      onSlotFound: (slot) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("slot-found", slot);
        }
      },
    });

    createMainWindow();

    setupTray({
      getMainWindow: () => mainWindow,
      onStopSearch: () => stopSearchTask(),
      onQuit: () => {
        isQuitting = true;
        stopSearchTask();
        app.quit();
      },
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Tray açık kaldığı için kapatmıyoruz
  }
});
