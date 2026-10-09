const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");
const moment = require("moment");

const CONFIG_FILE = path.join(app.getPath("userData"), "mhrs_config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
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

    if (updated.token && safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(updated.token);
        updated.encryptedToken = encrypted.toString("base64");
        delete updated.token;
      } catch (_) {}
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  loadConfig,
  saveConfig,
};
