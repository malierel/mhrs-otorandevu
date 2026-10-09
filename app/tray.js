const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

let trayInstance = null;

function setupTray({ getMainWindow, onStopSearch, onQuit }) {
  try {
    const icoPath = path.join(__dirname, "assets", "icon.ico");
    const trayIcon = nativeImage.createFromPath(icoPath);

    trayInstance = new Tray(trayIcon);
    trayInstance.setToolTip("MHRS Otomatik Randevu Asistanı");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Uygulamayı Aç",
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: "Taramayı Durdur",
        id: "stop-menu",
        click: () => {
          if (onStopSearch) onStopSearch();
        },
      },
      { type: "separator" },
      {
        label: "Çıkış Yap",
        click: () => {
          if (onQuit) onQuit();
        },
      },
    ]);

    trayInstance.setContextMenu(contextMenu);

    trayInstance.on("double-click", () => {
      const win = getMainWindow();
      if (win) {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
          win.focus();
        }
      }
    });

    return trayInstance;
  } catch (err) {
    console.warn("Tray oluşturulurken uyarı:", err.message);
    return null;
  }
}

function getTray() {
  return trayInstance;
}

module.exports = {
  setupTray,
  getTray,
};
