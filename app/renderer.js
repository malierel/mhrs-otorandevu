// UI Renderer Logic
document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const btnMinimize = document.getElementById("btnMinimize");
  const btnClose = document.getElementById("btnClose");
  const inputToken = document.getElementById("inputToken");
  const btnSaveToken = document.getElementById("btnSaveToken");
  const tokenStatusText = document.getElementById("tokenStatusText");

  const selectCity = document.getElementById("selectCity");
  const selectDistrict = document.getElementById("selectDistrict");
  const selectClinic = document.getElementById("selectClinic");

  const genderCards = document.querySelectorAll(".radio-card");
  const dayPills = document.querySelectorAll(".day-pill");
  const dateStart = document.getElementById("dateStart");
  const dateEnd = document.getElementById("dateEnd");

  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");
  const metricAttempts = document.getElementById("metricAttempts");
  const metricLastCheck = document.getElementById("metricLastCheck");
  const btnToggleSearch = document.getElementById("btnToggleSearch");
  const btnActionText = document.getElementById("btnActionText");

  const logBody = document.getElementById("logBody");
  const btnClearLog = document.getElementById("btnClearLog");
  const bookedBanner = document.getElementById("bookedBanner");
  const bookedDetails = document.getElementById("bookedDetails");

  let isRunning = false;
  let currentGender = "F";
  let activeDays = [1, 2, 3, 4, 5, 6, 7];

  // Titlebar controls
  btnMinimize.addEventListener("click", () => window.api.minimizeWindow());
  btnClose.addEventListener("click", () => window.api.closeWindow());

  // Log Ekleme Yardımcısı
  function appendLog(type, message, timeStr) {
    const time = timeStr || new Date().toLocaleTimeString("tr-TR");
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${escapeHtml(message)}</span>`;
    logBody.appendChild(div);
    logBody.scrollTop = logBody.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  btnClearLog.addEventListener("click", () => {
    logBody.innerHTML = "";
    appendLog("info", "Log ekranı temizlendi.");
  });

  // Cinsiyet seçimi
  genderCards.forEach(card => {
    card.addEventListener("click", () => {
      genderCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      currentGender = card.dataset.gender;
    });
  });

  // Gün seçimi
  dayPills.forEach(pill => {
    pill.addEventListener("click", () => {
      const day = parseInt(pill.dataset.day, 10);
      if (pill.classList.contains("active")) {
        if (activeDays.length > 1) {
          pill.classList.remove("active");
          activeDays = activeDays.filter(d => d !== day);
        }
      } else {
        pill.classList.add("active");
        activeDays.push(day);
      }
    });
  });

  // Yapılandırmayı yükle
  const config = await window.api.getConfig();
  if (config.token) {
    inputToken.value = config.token;
  }
  if (config.cinsiyet) {
    currentGender = config.cinsiyet;
    genderCards.forEach(c => {
      if (c.dataset.gender === currentGender) c.classList.add("active");
      else c.classList.remove("active");
    });
  }
  if (config.baslangicTarihi) dateStart.value = config.baslangicTarihi;
  if (config.bitisTarihi) dateEnd.value = config.bitisTarihi;
  if (config.izinVerilenGunler) {
    activeDays = config.izinVerilenGunler;
    dayPills.forEach(p => {
      const day = parseInt(p.dataset.day, 10);
      if (activeDays.includes(day)) p.classList.add("active");
      else p.classList.remove("active");
    });
  }

  // Token doğrulama ve kaydetme
  btnSaveToken.addEventListener("click", async () => {
    let rawToken = inputToken.value.trim();
    if (!rawToken) {
      tokenStatusText.innerHTML = `<span class="badge-bad">❌ Lütfen token yapıştırın!</span>`;
      return;
    }
    if (!rawToken.startsWith("Bearer ")) {
      rawToken = `Bearer ${rawToken}`;
      inputToken.value = rawToken;
    }

    tokenStatusText.innerHTML = `<span>⏳ Doğrulanıyor...</span>`;
    appendLog("info", "Token MHRS ile doğrulanıyor...");

    const res = await window.api.validateToken(rawToken);
    if (res.success) {
      tokenStatusText.innerHTML = `<span class="badge-ok">✅ Token Geçerli! (${res.count} aktif randevu)</span>`;
      appendLog("success", `Token doğrulandı! Kullanıcı oturumu açık.`);
      await window.api.saveConfig({ token: rawToken });
      loadCitiesList(config.ilPlaka);
    } else {
      tokenStatusText.innerHTML = `<span class="badge-bad">❌ Geçersiz: ${res.error}</span>`;
      appendLog("error", `Token hatası: ${res.error}`);
    }
  });

  // İl Listesini Çek
  async function loadCitiesList(selectedPlaka) {
    try {
      selectCity.innerHTML = `<option value="">İller yükleniyor...</option>`;
      const res = await window.api.loadCities();
      const cities = res?.data || [];
      selectCity.innerHTML = "";
      
      cities.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.text;
        if (selectedPlaka && String(selectedPlaka) === String(item.value)) {
          opt.selected = true;
        }
        selectCity.appendChild(opt);
      });

      // İlk yüklemede ilçeleri getir
      if (selectCity.value) {
        await loadDistrictsList(selectCity.value, config.ilceId);
      }
    } catch (e) {
      appendLog("error", `İller yüklenemedi: ${e.message}`);
    }
  }

  // İlçe Listesini Çek
  async function loadDistrictsList(plaka, selectedIlce) {
    try {
      selectDistrict.innerHTML = `<option value="-1">İlçeler yükleniyor...</option>`;
      const res = await window.api.loadDistricts(plaka);
      const districts = res?.data || [];
      
      selectDistrict.innerHTML = `<option value="-1">Fark Etmez (Tüm İlçeler)</option>`;
      districts.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.text;
        if (selectedIlce && String(selectedIlce) === String(item.value)) {
          opt.selected = true;
        }
        selectDistrict.appendChild(opt);
      });

      await loadClinicsList(selectCity.value, selectDistrict.value, config.klinikId);
    } catch (e) {
      appendLog("error", `İlçeler yüklenemedi: ${e.message}`);
    }
  }

  // Klinik Listesini Çek
  async function loadClinicsList(plaka, ilceId, selectedKlinik) {
    try {
      selectClinic.innerHTML = `<option value="">Klinikler yükleniyor...</option>`;
      const clinics = await window.api.loadClinics(plaka, ilceId);
      selectClinic.innerHTML = `<option value="">Klinik Seçiniz...</option>`;
      
      (clinics || []).forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.mhrsKlinikId;
        opt.textContent = item.klinikAdi;
        if (selectedKlinik && String(selectedKlinik) === String(item.mhrsKlinikId)) {
          opt.selected = true;
        }
        selectClinic.appendChild(opt);
      });
    } catch (e) {
      appendLog("error", `Klinikler yüklenemedi: ${e.message}`);
    }
  }

  // Şehir değişince
  selectCity.addEventListener("change", () => {
    loadDistrictsList(selectCity.value);
  });

  // İlçe değişince
  selectDistrict.addEventListener("change", () => {
    loadClinicsList(selectCity.value, selectDistrict.value);
  });

  // Taramayı Başlat / Durdur
  btnToggleSearch.addEventListener("click", async () => {
    if (!isRunning) {
      // Başlatma kontrolleri
      if (!inputToken.value.trim()) {
        alert("Lütfen önce MHRS Token'ınızı girip doğrulayın!");
        return;
      }
      if (!selectClinic.value) {
        alert("Lütfen bir poliklinik (klinik) seçiniz!");
        return;
      }

      const searchCriteria = {
        token: inputToken.value.trim(),
        ilPlaka: selectCity.value,
        ilAdi: selectCity.options[selectCity.selectedIndex]?.text || "",
        ilceId: selectDistrict.value,
        ilceAdi: selectDistrict.options[selectDistrict.selectedIndex]?.text || "Fark Etmez",
        klinikId: selectClinic.value,
        klinikAdi: selectClinic.options[selectClinic.selectedIndex]?.text || "",
        cinsiyet: currentGender,
        baslangicTarihi: dateStart.value,
        bitisTarihi: dateEnd.value,
        izinVerilenGunler: activeDays,
        otomatikAl: true,
      };

      await window.api.startSearch(searchCriteria);
      setRunningState(true);
    } else {
      await window.api.stopSearch();
      setRunningState(false);
    }
  });

  function setRunningState(running) {
    isRunning = running;
    if (running) {
      statusIndicator.classList.add("running");
      statusText.textContent = "🔍 Taranıyor...";
      statusText.style.color = "#10b981";
      btnToggleSearch.className = "btn-action btn-stop";
      btnToggleSearch.innerHTML = `<span>⏹</span><span>Taramayı Durdur</span>`;
    } else {
      statusIndicator.classList.remove("running");
      statusText.textContent = "Beklemede";
      statusText.style.color = "inherit";
      btnToggleSearch.className = "btn-action btn-start";
      btnToggleSearch.innerHTML = `<span>▶</span><span>Taramayı Başlat</span>`;
    }
  }

  // Event Listeners (Main Process IPC)
  window.api.onLog((item) => {
    appendLog(item.type, item.message, item.time);
  });

  window.api.onStatusUpdate((status) => {
    metricAttempts.textContent = status.attempts;
    metricLastCheck.textContent = status.lastCheckTime;
    setRunningState(status.active);
  });

  window.api.onAppointmentBooked((appointment) => {
    bookedBanner.style.display = "flex";
    bookedDetails.textContent = `${appointment.hekim} • ${appointment.tarih} (${appointment.hastane})`;
    setRunningState(false);
  });

  // Eğer token varsa açılışta hemen doğrulamayı dene
  if (config.token) {
    btnSaveToken.click();
  }
});
