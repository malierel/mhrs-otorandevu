const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const functions = require("../functions");

// Konfigürasyon dosyası yolu (kullanıcı verilerini saklar)
const CONFIG_FILE = path.join(app.getPath("userData"), "mhrs_config.json");

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Arama durumu
let searchActive = false;
let searchTimer = null;
let searchAttempts = 0;
let lastCheckTime = "-";

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      // Token şifreli kaydedilmişse çöz, değilse olduğu gibi kullan
      if (raw.encryptedToken && safeStorage.isEncryptionAvailable()) {
        try {
          raw.token = safeStorage.decryptString(Buffer.from(raw.encryptedToken, "base64"));
        } catch (_) {
          raw.token = "";
        }
      }
      return raw;
    }
  } catch (e) {
    console.error("Config okunamadı:", e.message);
  }
  return {
    token: "",
    ilPlaka: "16", // Varsayılan Bursa
    ilAdi: "BURSA",
    ilceId: -1,
    ilceAdi: "Fark Etmez",
    klinikId: null,
    klinikAdi: "",
    cinsiyet: "F",
    baslangicTarihi: moment().format("YYYY-MM-DD"),
    bitisTarihi: moment().add(15, "days").format("YYYY-MM-DD"),
    izinVerilenGunler: [1, 2, 3, 4, 5, 6, 7],
    tumGun: true,
    baslangicSaat: "09:00",
    bitisSaat: "17:00",
    otomatikAl: true,
  };
}

function saveConfig(data) {
  try {
    const current = loadConfig();
    const updated = { ...current, ...data };
    
    // Token'ı diskte düz metin bırakmamak için Windows DPAPI ile şifrele
    if (updated.token && safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(updated.token);
        updated.encryptedToken = encrypted.toString("base64");
        // Diske yazarken açık token alanını boşalt
        delete updated.token;
      } catch (_) {}
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Log gönderici (UI + Konsol)
function sendLog(type, message) {
  const time = moment().format("HH:mm:ss");
  const logItem = { time, type, message };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log-message", logItem);
  }
}

function sendStatusUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status-update", {
      active: searchActive,
      attempts: searchAttempts,
      lastCheckTime,
    });
  }
}

// Windows Toast Bildirimi
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
    icon: appIconPath, // Görev çubuğunda ve pencere sol üst köşesinde görünecek ikon
    frame: true, // Standart Windows başlık çubuğu ve kontrolleri (görünürlük garantisi)
    backgroundColor: "#f5f7fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: true,
  });

  // Electron'un varsayılan "File, Edit, View, Window" üst menü çubuğunu tamamen kaldır
  Menu.setApplicationMenu(null);

  console.log("Pencere oluşturuldu, dosya yükleniyor...");
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Arayüz (index.html) başarıyla yüklendi.");
  });

  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription) => {
    console.error("Yükleme hatası:", errorCode, errorDescription);
  });

  // Simge durumuna küçültüldüğünde (Minimize) sistem tepsisine (Tray) gizle
  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // Pencereyi kapatınca tamamen kapatmak yerine sistem tepsisine (Tray) küçült
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  try {
    const icoPath = path.join(__dirname, "assets", "icon.ico");
    const pngPath = path.join(__dirname, "assets", "icon.png");
    const trayIconPath = fs.existsSync(icoPath) ? icoPath : pngPath;
    const trayIcon = nativeImage.createFromPath(trayIconPath);

    tray = new Tray(trayIcon);
    tray.setToolTip("MHRS Otomatik Randevu Asistanı");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Uygulamayı Aç",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Taramayı Durdur",
      id: "stop-menu",
      click: () => {
        stopSearchTask();
      },
    },
    { type: "separator" },
    {
      label: "Çıkış Yap",
      click: () => {
        isQuitting = true;
        stopSearchTask();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  } catch (err) {
    console.warn("Tray oluşturulurken uyarı:", err.message);
  }
}

// MHRS Randevu Tarama Mantığı
async function executeSearchIteration() {
  if (!searchActive) return;

  const config = loadConfig();
  if (!config.token || !config.token.startsWith("Bearer eyJ")) {
    sendLog("error", "Geçerli bir MHRS token'ı girilmemiş!");
    stopSearchTask();
    return;
  }

  searchAttempts++;
  lastCheckTime = moment().format("HH:mm:ss");
  sendStatusUpdate();

  sendLog("info", `Tarama (#${searchAttempts}): ${config.ilAdi} - ${config.ilceAdi || "Tüm İlçeler"} - ${config.klinikAdi} kontrol ediliyor...`);

  try {
    const baslangicStr = `${config.baslangicTarihi} 00:00:00`;
    const bitisStr = `${config.bitisTarihi} 23:59:59`;
    const ilceId = config.ilceId && config.ilceId !== "f" && config.ilceId !== -1 ? Number(config.ilceId) : -1;

    const slotResponse = await functions.randevuAra(
      config.token,
      Number(config.ilPlaka),
      ilceId,
      config.cinsiyet || "F",
      Number(config.klinikId),
      baslangicStr,
      bitisStr
    );

    // MHRS sonuçları "hastane" veya "semt" dizisi içinde döner
    const hastaneList = slotResponse?.hastane || [];
    const semtList = slotResponse?.semt || [];
    const tumKurumlar = [...hastaneList, ...semtList];

    if (tumKurumlar.length === 0) {
      sendLog("warning", `Boş randevu bulunamadı. (Son kontrol: ${lastCheckTime})`);
      scheduleNextRun();
      return;
    }

    sendLog("success", `🎯 ${tumKurumlar.length} hekim/kurumda boş randevu imkanı tespit edildi! Detaylar taranıyor...`);

    // En yakın tarihli olanlara göre sırala
    tumKurumlar.sort((a, b) => {
      const tA = a.baslangicZamani ? new Date(a.baslangicZamani).getTime() : 0;
      const tB = b.baslangicZamani ? new Date(b.baslangicZamani).getTime() : 0;
      return tA - tB;
    });

    let booked = false;

    for (const item of tumKurumlar) {
      if (booked) break;
      const hastaneAdi = item.kurum?.kurumAdi || item.kurum?.kurumKisaAdi || "Hastane";
      const hekimAdi = item.hekim ? `${item.hekim.ad} ${item.hekim.soyad}`.trim() : "Hekim";
      const kurumId = item.kurum?.mhrsKurumId;
      const hekimId = item.hekim?.mhrsHekimId;

      if (!kurumId || !hekimId) continue;

      sendLog("info", `${hastaneAdi} - Dr. ${hekimAdi} saat detayları sorgulanıyor...`);

      try {
        const hekimVerisi = await functions.hekimAra(
          config.token,
          Number(config.ilPlaka),
          config.cinsiyet || "F",
          Number(config.klinikId),
          kurumId,
          hekimId
        );

        const hekimList = Array.isArray(hekimVerisi) ? hekimVerisi : [hekimVerisi];

        for (const hekimObj of hekimList) {
          if (booked) break;
          // hekimSlotList veya doğrudan muayeneYeriSlotList
          const hekimSlotList = hekimObj.hekimSlotList || [hekimObj];

          for (const hekimSlot of hekimSlotList) {
            if (booked) break;
            for (const yerSlot of hekimSlot.muayeneYeriSlotList || []) {
              if (booked) break;
              for (const saatSlot of yerSlot.saatSlotList || []) {
                if (booked) break;
                if (!saatSlot.bos) continue;

                // Slot listesi nesne veya dizi olabilir
                const rawSlots = saatSlot.slotList;
                const slotArray = Array.isArray(rawSlots) ? rawSlots : Object.values(rawSlots || {});

                for (const slotObj of slotArray) {
                  if (booked) break;
                  // slot yapısı ya doğrudan slotObj ya da slotObj.slot
                  const slot = slotObj.slot || slotObj;
                  if (!slot || slot.bos === false) continue;

                  const slotTarihi = moment(slot.baslangicZamani);
                  const gunNumarasi = slotTarihi.isoWeekday(); // 1=Pzt, 7=Paz
                  const gunIsimleri = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
                  const slotGunAdi = gunIsimleri[gunNumarasi - 1];
                  const slotSaatStr = slotTarihi.format("HH:mm");

                  // 1. Gün Filtresi Kontrolü
                  if (config.izinVerilenGunler && !config.izinVerilenGunler.includes(gunNumarasi)) {
                    sendLog("warning", `ℹ️ Randevu bulundu (${slot.baslangicZamani} - ${slotGunAdi}) fakat izin verilen günlere uymuyor.`);
                    continue;
                  }

                  // 2. Saat Dilimi Kontrolü
                  if (!config.tumGun && config.baslangicSaat && config.bitisSaat) {
                    if (slotSaatStr < config.baslangicSaat || slotSaatStr > config.bitisSaat) {
                      sendLog("warning", `ℹ️ Randevu bulundu (${slot.baslangicZamani}) fakat saat diliminize (${config.baslangicSaat} - ${config.bitisSaat}) uymuyor.`);
                      continue;
                    }
                  }

                  sendLog("success", `🎉 UYGUN SLOT BULUNDU: Dr. ${hekimAdi} | ${slot.baslangicZamani}`);

                  if (config.otomatikAl) {
                    sendLog("info", `Randevu onaylanıyor... Lütfen bekleyin.`);
                    try {
                      await functions.randevuAl(
                        config.token,
                        slot.id,
                        slot.fkCetvelId,
                        slot.baslangicZamani,
                        slot.bitisZamani
                      );

                      const basariMesaj = `Randevunuz Başarıyla Alındı!\nDr. ${hekimAdi}\n${hastaneAdi}\nTarih: ${slot.baslangicZamani}`;
                      sendLog("success", `✅ ${basariMesaj.replace(/\n/g, " ")}`);

                      showNotification("🎉 MHRS Randevusu Alındı!", `Dr. ${hekimAdi} - ${slot.baslangicZamani} (${hastaneAdi})`);

                      if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send("appointment-booked", {
                          hekim: `Dr. ${hekimAdi}`,
                          hastane: hastaneAdi,
                          tarih: slot.baslangicZamani,
                        });
                      }

                      booked = true;
                      stopSearchTask();
                    } catch (err) {
                      const apiErr = err.response?.data?.errors?.[0];
                      const errCode = apiErr?.kodu;
                      const errMsg = apiErr?.mesaj || err.message;
                      sendLog("error", `Randevu onaylanırken hata oluştu: ${errMsg}`);

                      // Zaten bu saatte veya klinikte randevu varsa döngüyü boşuna zorlamayıp durdur
                      if (errCode === "RND6034" || (errMsg && errMsg.includes("daha önce oluşturulmuş randevu"))) {
                        sendLog("warning", "⚠️ Bu saat diliminde zaten mevcut bir randevunuz olduğu için tarama otomatik durduruldu.");
                        showNotification("⚠️ Randevu Çakışması", "Bu saat diliminde zaten bir randevunuz bulunuyor.");
                        stopSearchTask();
                        return;
                      }
                    }
                  } else {
                    showNotification("🔔 Uygun Randevu Bulundu!", `Dr. ${hekimAdi} - ${slot.baslangicZamani}`);
                  }
                }
              }
            }
          }
        }
      } catch (hErr) {
        sendLog("warning", `Hekim detay hatası: ${hErr.message}`);
      }
    }

    if (!booked) {
      sendLog("warning", `İstenen gün ve kriterlere uygun boş slot kalmamış. 1 dk sonra tekrar kontrol edilecek.`);
      scheduleNextRun();
    }
  } catch (err) {
    const errMsg = err.response?.data?.errors?.[0]?.mesaj || err.message;
    sendLog("error", `MHRS Arama Hatası: ${errMsg}`);
    scheduleNextRun();
  }
}

function scheduleNextRun() {
  if (!searchActive) return;
  if (searchTimer) clearTimeout(searchTimer);
  // 60 saniye sonra bir sonraki kontrol
  searchTimer = setTimeout(() => {
    executeSearchIteration();
  }, 60000);
}

function startSearchTask(criteria) {
  if (criteria) saveConfig(criteria);
  searchActive = true;
  searchAttempts = 0;
  sendStatusUpdate();
  sendLog("info", "🚀 Randevu tarama görevi başlatıldı.");
  executeSearchIteration();
  return { success: true };
}

function stopSearchTask() {
  searchActive = false;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  sendStatusUpdate();
  sendLog("warning", "⏹ Randevu taraması durduruldu.");
  return { success: true };
}

// IPC Kanalları
ipcMain.handle("get-config", () => loadConfig());
ipcMain.handle("save-config", (_event, data) => saveConfig(data));

ipcMain.handle("validate-token", async (_event, token) => {
  try {
    const res = await functions.kullaniciRandevulari(token);
    return { success: true, count: res?.length || 0 };
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

ipcMain.handle("start-search", (_event, criteria) => startSearchTask(criteria));
ipcMain.handle("stop-search", () => stopSearchTask());

ipcMain.on("minimize-window", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("close-window", () => {
  if (mainWindow) mainWindow.hide();
});

// Tekil örnek kontrolü (Aynı anda 2 uygulama açılmasın)
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
    // Windows görev çubuğunda ve bildirimlerde doğru ikon ve isimle görünmesini sağlar
    app.setAppUserModelId("com.mhrs.otorandevu");

    createMainWindow();
    createTray();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Tray açık kalması istendiği için mainWindow.on('close') handle ediyor.
  }
});
