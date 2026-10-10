const moment = require("moment");
const functions = require("../functions");
const { loadConfig, saveConfig } = require("./config");

let searchActive = false;
let searchTimer = null;
let searchAttempts = 0;
let lastCheckTime = "-";
let consecutiveNetworkErrors = 0;

let callbacks = {
  sendLog: () => {},
  sendStatusUpdate: () => {},
  showNotification: () => {},
  onAppointmentBooked: () => {},
  onSlotFound: () => {},
};

function initScanner(cbs) {
  callbacks = { ...callbacks, ...cbs };
}

let nextRunAt = null;
let totalDelayMs = 0;

function getScannerState() {
  return {
    active: searchActive,
    attempts: searchAttempts,
    lastCheckTime,
    nextRunAt,
    totalDelayMs,
  };
}

function scheduleNextRun(delayMs = 60000) {
  if (!searchActive) return;
  if (searchTimer) clearTimeout(searchTimer);
  totalDelayMs = delayMs;
  nextRunAt = Date.now() + delayMs;
  callbacks.sendStatusUpdate();
  searchTimer = setTimeout(() => {
    nextRunAt = null;
    totalDelayMs = 0;
    callbacks.sendStatusUpdate();
    executeSearchIteration();
  }, delayMs);
}

async function executeSearchIteration() {
  if (!searchActive) return;

  const config = loadConfig();
  if (!config.token || !config.token.startsWith("Bearer eyJ")) {
    callbacks.sendLog("error", "Geçerli bir MHRS token'ı girilmemiş!");
    stopSearchTask();
    return;
  }

  searchAttempts++;
  lastCheckTime = moment().format("HH:mm:ss");
  callbacks.sendStatusUpdate();

  callbacks.sendLog("info", `Tarama (#${searchAttempts}): ${config.ilAdi} - ${config.ilceAdi || "Tüm İlçeler"} - ${config.klinikAdi} kontrol ediliyor...`);

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

    const hastaneList = slotResponse?.hastane || [];
    const semtList = slotResponse?.semt || [];
    const tumKurumlar = [...hastaneList, ...semtList];

    if (tumKurumlar.length === 0) {
      callbacks.sendLog("warning", `Boş randevu bulunamadı. (Son kontrol: ${lastCheckTime})`);
      scheduleNextRun();
      return;
    }

    callbacks.sendLog("success", `🎯 ${tumKurumlar.length} hekim/kurumda boş randevu imkanı tespit edildi! Detaylar taranıyor...`);

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

      callbacks.sendLog("info", `${hastaneAdi} - Dr. ${hekimAdi} saat detayları sorgulanıyor...`);

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
          const hekimSlotList = hekimObj.hekimSlotList || [hekimObj];

          for (const hekimSlot of hekimSlotList) {
            if (booked) break;
            for (const yerSlot of hekimSlot.muayeneYeriSlotList || []) {
              if (booked) break;
              for (const saatSlot of yerSlot.saatSlotList || []) {
                if (booked) break;
                if (!saatSlot.bos) continue;

                const rawSlots = saatSlot.slotList;
                const slotArray = Array.isArray(rawSlots) ? rawSlots : Object.values(rawSlots || {});

                for (const slotObj of slotArray) {
                  if (booked) break;
                  const slot = slotObj.slot || slotObj;
                  if (!slot || slot.bos === false) continue;

                  const slotTarihi = moment(slot.baslangicZamani);
                  const gunNumarasi = slotTarihi.isoWeekday();
                  const gunIsimleri = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
                  const slotGunAdi = gunIsimleri[gunNumarasi - 1];
                  const slotSaatStr = slotTarihi.format("HH:mm");

                  if (config.izinVerilenGunler && !config.izinVerilenGunler.includes(gunNumarasi)) {
                    callbacks.sendLog("warning", `ℹ️ Randevu bulundu (${slot.baslangicZamani} - ${slotGunAdi}) fakat izin verilen günlere uymuyor.`);
                    callbacks.onSlotFound({
                      hekim: `Dr. ${hekimAdi}`,
                      hastane: hastaneAdi,
                      tarih: `${slot.baslangicZamani} (${slotGunAdi})`,
                      status: "gun-uymadi",
                      statusText: "İstenmeyen Gün",
                    });
                    continue;
                  }

                  if (!config.tumGun && config.baslangicSaat && config.bitisSaat) {
                    if (slotSaatStr < config.baslangicSaat || slotSaatStr > config.bitisSaat) {
                      callbacks.sendLog("warning", `ℹ️ Randevu bulundu (${slot.baslangicZamani}) fakat saat diliminize (${config.baslangicSaat} - ${config.bitisSaat}) uymuyor.`);
                      callbacks.onSlotFound({
                        hekim: `Dr. ${hekimAdi}`,
                        hastane: hastaneAdi,
                        tarih: `${slot.baslangicZamani} (${slotGunAdi})`,
                        status: "saat-uymadi",
                        statusText: "Saat Uymadı",
                      });
                      continue;
                    }
                  }

                  callbacks.sendLog("success", `🎉 UYGUN SLOT BULUNDU: Dr. ${hekimAdi} | ${slot.baslangicZamani}`);

                  if (config.otomatikAl) {
                    callbacks.sendLog("info", `Randevu onaylanıyor... Lütfen bekleyin.`);
                    try {
                      await functions.randevuAl(
                        config.token,
                        slot.id,
                        slot.fkCetvelId,
                        slot.baslangicZamani,
                        slot.bitisZamani
                      );

                      const basariMesaj = `Randevunuz Başarıyla Alındı!\nDr. ${hekimAdi}\n${hastaneAdi}\nTarih: ${slot.baslangicZamani}`;
                      callbacks.sendLog("success", `✅ ${basariMesaj.replace(/\n/g, " ")}`);

                      callbacks.onSlotFound({
                        hekim: `Dr. ${hekimAdi}`,
                        hastane: hastaneAdi,
                        tarih: `${slot.baslangicZamani} (${slotGunAdi})`,
                        status: "alindi",
                        statusText: "Başarıyla Alındı",
                      });

                      callbacks.showNotification("🎉 MHRS Randevusu Alındı!", `Dr. ${hekimAdi} - ${slot.baslangicZamani} (${hastaneAdi})`);
                      callbacks.onAppointmentBooked({
                        hekim: `Dr. ${hekimAdi}`,
                        hastane: hastaneAdi,
                        tarih: slot.baslangicZamani,
                      });

                      booked = true;
                      stopSearchTask();
                      return;
                    } catch (err) {
                      const apiErr = err.response?.data?.errors?.[0];
                      const errCode = apiErr?.kodu;
                      const errMsg = apiErr?.mesaj || err.message;
                      callbacks.sendLog("error", `Randevu onaylanırken hata oluştu: ${errMsg}`);

                      callbacks.onSlotFound({
                        hekim: `Dr. ${hekimAdi}`,
                        hastane: hastaneAdi,
                        tarih: `${slot.baslangicZamani} (${slotGunAdi})`,
                        status: "hata",
                        statusText: "Onay Başarısız",
                      });

                      if (errCode === "RND6034" || (errMsg && errMsg.includes("daha önce oluşturulmuş randevu"))) {
                        callbacks.sendLog("warning", "⚠️ Bu saat diliminde zaten mevcut bir randevunuz olduğu için tarama otomatik durduruldu.");
                        callbacks.showNotification("⚠️ Randevu Çakışması", "Bu saat diliminde zaten bir randevunuz bulunuyor.");
                        stopSearchTask();
                        return;
                      }
                    }
                  } else {
                    callbacks.showNotification("🔔 Uygun Randevu Bulundu!", `Dr. ${hekimAdi} - ${slot.baslangicZamani}`);
                  }
                }
              }
            }
          }
        }
      } catch (hErr) {
        callbacks.sendLog("warning", `Hekim detay hatası: ${hErr.message}`);
      }
    }

    if (!booked) {
      callbacks.sendLog("warning", `İstenen gün ve kriterlere uygun boş slot kalmamış. 1 dk sonra tekrar kontrol edilecek.`);
      scheduleNextRun();
    }
  } catch (err) {
    const status = err.response?.status;
    const errMsg = err.response?.data?.errors?.[0]?.mesaj || err.message;

    if (status === 401 || (errMsg && errMsg.toLowerCase().includes("yetkisiz"))) {
      callbacks.sendLog("error", "❌ MHRS Oturum Süreniz Doldu! (401 Yetkisiz Erişim)");
      callbacks.showNotification("⚠️ MHRS Oturumu Kapandı", "Token süreniz doldu. Lütfen yeni token alıp giriniz.");
      stopSearchTask();
      return;
    }

    const isNetworkError = err.code === "ECONNRESET" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT" || !err.response;
    if (isNetworkError) {
      consecutiveNetworkErrors++;
      const waitSeconds = Math.min(300, 30 * Math.pow(1.5, consecutiveNetworkErrors));
      callbacks.sendLog("warning", `📡 İnternet/MHRS bağlantısı bekleniyor (${err.code || "Ağ Hatası"}). ${Math.round(waitSeconds)} sn sonra tekrar denenecek.`);
      scheduleNextRun(waitSeconds * 1000);
      return;
    }

    consecutiveNetworkErrors = 0;
    callbacks.sendLog("error", `MHRS Arama Hatası: ${errMsg}`);
    scheduleNextRun();
  }
}

function startSearchTask(criteria) {
  if (criteria) saveConfig(criteria);
  searchActive = true;
  searchAttempts = 0;
  consecutiveNetworkErrors = 0;
  nextRunAt = null;
  totalDelayMs = 0;
  callbacks.sendStatusUpdate();
  callbacks.sendLog("info", "🚀 Randevu tarama görevi başlatıldı.");
  executeSearchIteration();
  return { success: true };
}

function stopSearchTask() {
  searchActive = false;
  consecutiveNetworkErrors = 0;
  nextRunAt = null;
  totalDelayMs = 0;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  callbacks.sendStatusUpdate();
  callbacks.sendLog("warning", "⏹ Randevu taraması durduruldu.");
  return { success: true };
}

module.exports = {
  initScanner,
  startSearchTask,
  stopSearchTask,
  getScannerState,
};
