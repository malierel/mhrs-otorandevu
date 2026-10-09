// UI Renderer Logic
document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
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

  // Log Ekleme Yardımcısı (Bellek sızıntısını önlemek için en fazla 300 satır tutar)
  const MAX_LOG_ENTRIES = 300;
  function appendLog(type, message, timeStr) {
    const time = timeStr || new Date().toLocaleTimeString("tr-TR");
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${escapeHtml(message)}</span>`;
    logBody.appendChild(div);

    // 300'den fazla log varsa en eskileri silerek DOM belleğini koru
    while (logBody.children.length > MAX_LOG_ENTRIES) {
      logBody.removeChild(logBody.firstChild);
    }

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

  const chkAllDay = document.getElementById("chkAllDay");
  const timeInputsContainer = document.getElementById("timeInputsContainer");
  const timeStart = document.getElementById("timeStart");
  const timeEnd = document.getElementById("timeEnd");

  // Tüm gün onay kutusu değiştiğinde
  chkAllDay.addEventListener("change", () => {
    if (chkAllDay.checked) {
      timeInputsContainer.style.opacity = "0.45";
      timeInputsContainer.style.pointerEvents = "none";
    } else {
      timeInputsContainer.style.opacity = "1";
      timeInputsContainer.style.pointerEvents = "auto";
    }
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
  if (config.tumGun !== undefined) {
    chkAllDay.checked = config.tumGun;
    if (config.tumGun) {
      timeInputsContainer.style.opacity = "0.45";
      timeInputsContainer.style.pointerEvents = "none";
    } else {
      timeInputsContainer.style.opacity = "1";
      timeInputsContainer.style.pointerEvents = "auto";
    }
  }
  if (config.baslangicSaat) timeStart.value = config.baslangicSaat;
  if (config.bitisSaat) timeEnd.value = config.bitisSaat;
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
      console.log("Gelen iller verisi:", res);
      // MHRS API doğrudan array veya { data: [...] } dönebilir
      const cities = Array.isArray(res) ? res : (res?.data || []);
      selectCity.innerHTML = "";
      
      if (cities.length === 0) {
        selectCity.innerHTML = `<option value="">İller bulunamadı (Yeniden deneyin)</option>`;
        appendLog("warning", "İl listesi boş döndü.");
        return;
      }

      // Alfabetik sırala
      cities.sort((a, b) => (a.text || "").localeCompare(b.text || "", "tr"));

      cities.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.text;
        if (selectedPlaka && String(selectedPlaka) === String(item.value)) {
          opt.selected = true;
        }
        selectCity.appendChild(opt);
      });

      appendLog("info", `${cities.length} il başarıyla listelendi.`);

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
      const districts = Array.isArray(res) ? res : (res?.data || []);
      
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
      const res = await window.api.loadClinics(plaka, ilceId);
      const rawClinics = Array.isArray(res) ? res : (res?.data || []);
      
      selectClinic.innerHTML = `<option value="">Klinik Seçiniz...</option>`;
      
      if (rawClinics.length === 0) {
        selectClinic.innerHTML = `<option value="">Klinik bulunamadı</option>`;
        return;
      }

      // MHRS API select-input nesnesi: { value: 123, text: "Göz Hastalıkları" } veya { mhrsKlinikId, klinikAdi }
      const clinics = rawClinics.map(item => ({
        id: item.value !== undefined ? item.value : (item.mhrsKlinikId || item.id),
        name: item.text || item.klinikAdi || item.adi || "Bilinmeyen Klinik"
      }));

      // Alfabetik sırala
      clinics.sort((a, b) => a.name.localeCompare(b.name, "tr"));

      clinics.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        if (selectedKlinik && String(selectedKlinik) === String(item.id)) {
          opt.selected = true;
        }
        selectClinic.appendChild(opt);
      });

      appendLog("info", `${clinics.length} klinik yüklendi.`);
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
        tumGun: chkAllDay.checked,
        baslangicSaat: timeStart.value || "09:00",
        bitisSaat: timeEnd.value || "17:00",
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
