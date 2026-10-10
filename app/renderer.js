// UI Renderer Logic
document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const inputToken = document.getElementById("inputToken");
  const btnSaveToken = document.getElementById("btnSaveToken");
  const tokenStatusText = document.getElementById("tokenStatusText");

  const selectCity = document.getElementById("selectCity");
  const selectDistrict = document.getElementById("selectDistrict");
  const selectClinic = document.getElementById("selectClinic");

  const comboCityInput = document.getElementById("comboCityInput");
  const comboCityDropdown = document.getElementById("comboCityDropdown");
  const comboDistrictInput = document.getElementById("comboDistrictInput");
  const comboDistrictDropdown = document.getElementById("comboDistrictDropdown");
  const comboClinicInput = document.getElementById("comboClinicInput");
  const comboClinicDropdown = document.getElementById("comboClinicDropdown");

  const quickDateChips = document.querySelectorAll(".quick-date-chip");

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

  const countdownWidget = document.getElementById("countdownWidget");
  const countdownCircle = document.getElementById("countdownCircle");
  const countdownSecText = document.getElementById("countdownSecText");
  const countdownStatusText = document.getElementById("countdownStatusText");

  const logBody = document.getElementById("logBody");
  const slotsCardsContainer = document.getElementById("slotsCardsContainer");
  const slotsCardsList = document.getElementById("slotsCardsList");
  const slotsStatsBar = document.getElementById("slotsStatsBar");
  const statDoctorsCount = document.getElementById("statDoctorsCount");
  const statSlotsCount = document.getElementById("statSlotsCount");

  const btnClearLog = document.getElementById("btnClearLog");
  const btnCopyLogs = document.getElementById("btnCopyLogs");
  const btnToggleAutoScroll = document.getElementById("btnToggleAutoScroll");
  const logFilterBtns = document.querySelectorAll(".log-filter-btn");

  const bookedBanner = document.getElementById("bookedBanner");
  const bookedDetails = document.getElementById("bookedDetails");

  let isRunning = false;
  let currentGender = "F";
  let activeDays = [1, 2, 3, 4, 5, 6, 7];
  let autoScrollEnabled = true;
  let currentLogFilter = "all";
  let discoveredSlotsList = [];

  // Log Ekleme Yardımcısı (Bellek sızıntısını önlemek için en fazla 300 satır tutar)
  const MAX_LOG_ENTRIES = 300;
  function appendLog(type, message, timeStr) {
    const time = timeStr || new Date().toLocaleTimeString("tr-TR");
    const div = document.createElement("div");
    div.className = "log-entry";
    div.dataset.type = type;
    div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${escapeHtml(message)}</span>`;

    // Filtre kontrolü
    if (shouldShowLogEntry(type)) {
      div.style.display = "block";
    } else {
      div.style.display = "none";
    }

    logBody.appendChild(div);

    // 300'den fazla log varsa en eskileri silerek DOM belleğini koru
    while (logBody.children.length > MAX_LOG_ENTRIES) {
      logBody.removeChild(logBody.firstChild);
    }

    if (autoScrollEnabled) {
      logBody.scrollTop = logBody.scrollHeight;
    }
  }

  function shouldShowLogEntry(type) {
    if (currentLogFilter === "all") return true;
    if (currentLogFilter === "error") return type === "error" || type === "warning";
    return true;
  }

  // Gruplanmış Hekim Kartları & Saat Hapları Görünümü
  function renderGroupedSlotCards() {
    slotsCardsList.innerHTML = "";
    if (discoveredSlotsList.length === 0) {
      slotsStatsBar.style.display = "none";
      slotsCardsList.innerHTML = `
        <div class="slots-empty-state">Henüz tespit edilen uygun randevu slotu bulunmuyor.</div>
      `;
      return;
    }

    // 1. Bir hekim için tek kart: Hekim + Hastane bazında grupla
    const doctorMap = new Map();

    discoveredSlotsList.forEach(item => {
      const parts = item.tarih.split(" ");
      const datePart = parts[0] || ""; // 2026-10-15
      const timePart = parts[1] || ""; // 14:30:00 veya 14:30
      const dayName = parts[2] || "";  // (Perşembe)

      const docKey = `${item.hekim}___${item.hastane}`;
      if (!doctorMap.has(docKey)) {
        doctorMap.set(docKey, {
          hekim: item.hekim,
          hastane: item.hastane,
          daysMap: new Map(),
        });
      }

      const docObj = doctorMap.get(docKey);
      const dateKey = datePart;

      if (!docObj.daysMap.has(dateKey)) {
        docObj.daysMap.set(dateKey, {
          dateStr: `${datePart} ${dayName}`.trim(),
          slots: [],
        });
      }

      const dayObj = docObj.daysMap.get(dateKey);
      const timeShort = timePart.substring(0, 5); // 14:30

      if (!dayObj.slots.some(s => s.timeShort === timeShort)) {
        dayObj.slots.push({
          timeShort,
          fullTarih: item.tarih,
          status: item.status,
          statusText: item.statusText,
        });
      }
    });

    const doctorsList = Array.from(doctorMap.values());

    // İstatistikleri hesapla
    let totalSlotsCount = 0;
    doctorsList.forEach(doc => {
      doc.days = Array.from(doc.daysMap.values());
      doc.days.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      doc.days.forEach(d => {
        totalSlotsCount += d.slots.length;
        d.slots.sort((a, b) => a.timeShort.localeCompare(b.timeShort));
      });
    });

    statDoctorsCount.textContent = doctorsList.length;
    statSlotsCount.textContent = totalSlotsCount;
    slotsStatsBar.style.display = "flex";

    // 2. Her hekim için TEK bir kart oluştur
    doctorsList.forEach(doc => {
      const card = document.createElement("div");
      card.className = "slot-doctor-card";

      // Başlık: Hekim Adı ve Hastane
      const headerDiv = document.createElement("div");
      headerDiv.className = "slot-card-header";
      headerDiv.innerHTML = `
        <div class="slot-doc-info">
          <div class="slot-doc-name">
            <span>👨‍⚕️</span>
            <span>${escapeHtml(doc.hekim)}</span>
          </div>
          <div class="slot-doc-hospital">🏥 ${escapeHtml(doc.hastane)}</div>
        </div>
      `;
      card.appendChild(headerDiv);

      // Günler ve Saatler Konteyneri
      const daysContainer = document.createElement("div");
      daysContainer.className = "slot-days-container";

      doc.days.forEach(day => {
        const dayRow = document.createElement("div");
        dayRow.className = "slot-day-row";

        // Gün Etiketi
        const dayBadge = document.createElement("div");
        dayBadge.className = "slot-day-badge";
        dayBadge.innerHTML = `<span>📅</span><span>${escapeHtml(day.dateStr)}</span>`;
        dayRow.appendChild(dayBadge);

        // O Güne Ait Saat Hapları
        const timesGrid = document.createElement("div");
        timesGrid.className = "slot-times-grid";

        day.slots.forEach(slot => {
          const pill = document.createElement("div");

          let pillClass = "pill-uygun";
          let icon = "🟢";
          let tooltip = "Kriterlere uygun boş saat";

          if (slot.status === "alindi") {
            pillClass = "pill-alindi";
            icon = "✅";
            tooltip = "Randevunuz başarıyla bu saate alındı!";
          } else if (slot.status === "saat-uymadi") {
            pillClass = "pill-saat-uymadi";
            icon = "⏳";
            tooltip = "Kullanıcı saat aralığı dışında kalan slot";
          } else if (slot.status === "gun-uymadi") {
            pillClass = "pill-gun-uymadi";
            icon = "⚪";
            tooltip = "Seçili günler dışında kalan slot";
          } else if (slot.status === "hata") {
            pillClass = "pill-hata";
            icon = "❌";
            tooltip = "Onaylama sırasında hata oluştu";
          }

          pill.className = `slot-time-pill ${pillClass}`;
          pill.title = tooltip;
          pill.innerHTML = `
            <span>${icon}</span>
            <span>${escapeHtml(slot.timeShort)}</span>
          `;
          timesGrid.appendChild(pill);
        });

        dayRow.appendChild(timesGrid);
        daysContainer.appendChild(dayRow);
      });

      card.appendChild(daysContainer);
      slotsCardsList.appendChild(card);
    });
  }

  function applyLogFilter(filterName) {
    currentLogFilter = filterName;

    if (filterName === "slot") {
      // Gruplanmış Hekim Kartları Modu
      logBody.style.display = "none";
      slotsCardsContainer.style.display = "flex";
      btnToggleAutoScroll.style.display = "none";
      renderGroupedSlotCards();
    } else {
      // Terminal Log Modu
      slotsCardsContainer.style.display = "none";
      logBody.style.display = "block";
      btnToggleAutoScroll.style.display = "flex";

      const entries = logBody.querySelectorAll(".log-entry");
      entries.forEach(entry => {
        const type = entry.dataset.type;
        entry.style.display = shouldShowLogEntry(type) ? "block" : "none";
      });

      if (autoScrollEnabled) {
        logBody.scrollTop = logBody.scrollHeight;
      }
    }
  }

  // Log Filtreleme Sekmeleri
  logFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      logFilterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyLogFilter(btn.dataset.filter);
    });
  });

  // Otomatik Kaydırma Aç/Kapa
  btnToggleAutoScroll.addEventListener("click", () => {
    autoScrollEnabled = !autoScrollEnabled;
    if (autoScrollEnabled) {
      btnToggleAutoScroll.className = "log-btn-tool active-toggle";
      btnToggleAutoScroll.innerHTML = `<span>⬇️ Oto-Kaydır: Açık</span>`;
      logBody.scrollTop = logBody.scrollHeight;
    } else {
      btnToggleAutoScroll.className = "log-btn-tool";
      btnToggleAutoScroll.innerHTML = `<span>⏸️ Oto-Kaydır: Kapalı</span>`;
    }
  });

  // Kullanıcı logları elle yukarı kaydırırsa otomatik algıla
  logBody.addEventListener("scroll", () => {
    const isAtBottom = logBody.scrollHeight - logBody.scrollTop <= logBody.clientHeight + 25;
    if (!isAtBottom && autoScrollEnabled) {
      // Kullanıcı geçmişi okuyor
    }
  });

  // Tüm Logları Panoya Kopyala
  btnCopyLogs.addEventListener("click", async () => {
    const visibleEntries = Array.from(logBody.querySelectorAll(".log-entry"))
      .filter(e => e.style.display !== "none")
      .map(e => e.innerText)
      .join("\n");

    if (!visibleEntries.trim()) {
      alert("Kopyalanacak log bulunamadı.");
      return;
    }

    try {
      await navigator.clipboard.writeText(visibleEntries);
      const originalText = btnCopyLogs.innerHTML;
      btnCopyLogs.innerHTML = `<span>✅ Kopyalandı!</span>`;
      setTimeout(() => {
        btnCopyLogs.innerHTML = originalText;
      }, 1500);
    } catch (_) {
      alert("Panoya kopyalama başarısız oldu.");
    }
  });

  function escapeHtml(str) {
    return (str || "").replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  btnClearLog.addEventListener("click", () => {
    logBody.innerHTML = "";
    discoveredSlotsList = [];
    renderGroupedSlotCards();
    appendLog("info", "Log ekranı ve slot geçmişi temizlendi.");
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

  // MHRS 15 Gün Kuralı & Tarih Sınırlandırması (En kullanıcı dostu çözüm)
  function fmtISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const todayObj = new Date();
  const maxMhrsDateObj = new Date();
  maxMhrsDateObj.setDate(todayObj.getDate() + 15);

  const todayStr = fmtISODate(todayObj);
  const maxMhrsDateStr = fmtISODate(maxMhrsDateObj);

  // HTML5 min ve max niteliklerini takvime doğrudan uygula (Kullanıcı 15 gün sonrasını seçemez)
  dateStart.min = todayStr;
  dateStart.max = maxMhrsDateStr;
  dateEnd.min = todayStr;
  dateEnd.max = maxMhrsDateStr;

  // Başlangıç tarihi değiştiğinde bitiş tarihinin min değerini otomatik güncelle
  dateStart.addEventListener("change", () => {
    if (dateStart.value < todayStr) dateStart.value = todayStr;
    if (dateStart.value > maxMhrsDateStr) dateStart.value = maxMhrsDateStr;
    dateEnd.min = dateStart.value;
    if (dateEnd.value < dateStart.value) {
      dateEnd.value = dateStart.value;
    }
  });

  // Bitiş tarihi değiştiğinde maksimum 15 gün kuralını anında denetle
  dateEnd.addEventListener("change", () => {
    if (dateEnd.value > maxMhrsDateStr) {
      dateEnd.value = maxMhrsDateStr;
      appendLog("warning", "⚠️ MHRS randevuları en fazla 15 gün sonrasına açılmaktadır. Bitiş tarihi otomatik olarak 15. güne sabitlendi.");
    }
    if (dateEnd.value < dateStart.value) {
      dateStart.value = dateEnd.value;
    }
  });

  // Hızlı Tarih Butonları (Örn: İlk 3 Gün, İlk 7 Gün, Önümüzdeki 15 Gün)
  quickDateChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const days = parseInt(chip.dataset.days, 10);
      const future = new Date();
      future.setDate(todayObj.getDate() + days);

      dateStart.value = todayStr;
      dateEnd.value = fmtISODate(future);
      appendLog("info", `📅 Tarih aralığı ayarlandı: ${dateStart.value} ile ${dateEnd.value} arası (${days} gün).`);
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
  
  // Kayıtlı tarihler varsa yükle, yoksa veya 15 günü aşıyorsa güvenli sınırlara çek
  dateStart.value = config.baslangicTarihi && config.baslangicTarihi >= todayStr && config.baslangicTarihi <= maxMhrsDateStr 
    ? config.baslangicTarihi 
    : todayStr;

  dateEnd.value = config.bitisTarihi && config.bitisTarihi >= todayStr && config.bitisTarihi <= maxMhrsDateStr 
    ? config.bitisTarihi 
    : maxMhrsDateStr;

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

  let tokenExpiryTimer = null;

  function updateTokenExpiryDisplay(expiresAt) {
    if (tokenExpiryTimer) clearInterval(tokenExpiryTimer);

    function tick() {
      if (!expiresAt) {
        tokenStatusText.innerHTML = `<span class="badge-ok">✅ Token Geçerli</span>`;
        return;
      }
      const diffMs = expiresAt - Date.now();
      if (diffMs <= 0) {
        tokenStatusText.innerHTML = `<span class="badge-bad" style="font-weight: 700;">❌ Token Süresi Dolmuş!</span>`;
        if (tokenExpiryTimer) clearInterval(tokenExpiryTimer);
        return;
      }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      tokenStatusText.innerHTML = `
        <span class="badge-ok" style="font-weight: 700;">✅ Token Aktif</span>
        <span style="color: #475569; font-weight: 600; font-family: monospace;">⏳ Kalan: ${hours} sa ${mins} dk ${secs} sn</span>
      `;
    }

    tick();
    tokenExpiryTimer = setInterval(tick, 1000);
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
      updateTokenExpiryDisplay(res.expiresAt);
      appendLog("success", `Token doğrulandı! Kullanıcı oturumu açık.`);
      await window.api.saveConfig({ token: rawToken });
      loadCitiesList(config.ilPlaka);
    } else {
      if (tokenExpiryTimer) clearInterval(tokenExpiryTimer);
      tokenStatusText.innerHTML = `<span class="badge-bad">❌ Geçersiz: ${res.error}</span>`;
      appendLog("error", `Token hatası: ${res.error}`);
    }
  });

  // Doğrudan Seçim Alanı Üzerinde Yazılarak Arama Yapan Combobox Motoru
  let allCitiesData = [];
  let allDistrictsData = [];
  let allClinicsData = [];

  function setupCombobox({ inputEl, dropdownEl, selectEl, getItems, defaultPlaceholder, onSelect }) {
    function renderList(filterText = "") {
      const q = (filterText || "").trim().toLocaleLowerCase("tr");
      dropdownEl.innerHTML = "";
      const items = getItems();

      const filtered = items.filter(it => {
        const text = (it.text || it.name || "").toLocaleLowerCase("tr");
        return text.includes(q);
      });

      if (filtered.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "combo-option empty";
        emptyDiv.textContent = "Eşleşen sonuç bulunamadı";
        dropdownEl.appendChild(emptyDiv);
        return;
      }

      filtered.forEach(it => {
        const val = it.value !== undefined ? it.value : it.id;
        const txt = it.text || it.name;
        const optDiv = document.createElement("div");
        optDiv.className = "combo-option";
        if (String(selectEl.value) === String(val)) {
          optDiv.classList.add("selected");
        }
        optDiv.textContent = txt;

        optDiv.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectEl.value = val;
          inputEl.value = txt;
          dropdownEl.classList.remove("open");
          if (onSelect) onSelect(val, txt);
        });

        dropdownEl.appendChild(optDiv);
      });
    }

    inputEl.addEventListener("focus", () => {
      renderList(inputEl.value === defaultPlaceholder ? "" : inputEl.value);
      dropdownEl.classList.add("open");
    });

    inputEl.addEventListener("input", (e) => {
      renderList(e.target.value);
      dropdownEl.classList.add("open");
    });

    inputEl.addEventListener("blur", () => {
      setTimeout(() => {
        dropdownEl.classList.remove("open");
        // Eğer hiçbir şey seçilmemişse seçili değeri tekrar inputa bas
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        if (selectedOpt && selectedOpt.value !== "") {
          inputEl.value = selectedOpt.textContent;
        } else if (defaultPlaceholder) {
          inputEl.value = defaultPlaceholder;
        }
      }, 150);
    });
  }

  // İl Combobox Kurulumu
  setupCombobox({
    inputEl: comboCityInput,
    dropdownEl: comboCityDropdown,
    selectEl: selectCity,
    getItems: () => allCitiesData,
    defaultPlaceholder: "",
    onSelect: (val) => {
      loadDistrictsList(val);
    }
  });

  // İlçe Combobox Kurulumu
  setupCombobox({
    inputEl: comboDistrictInput,
    dropdownEl: comboDistrictDropdown,
    selectEl: selectDistrict,
    getItems: () => [{ value: "-1", text: "Fark Etmez (Tüm İlçeler)" }, ...allDistrictsData],
    defaultPlaceholder: "Fark Etmez (Tüm İlçeler)",
    onSelect: (val) => {
      loadClinicsList(selectCity.value, val);
    }
  });

  // Klinik Combobox Kurulumu
  setupCombobox({
    inputEl: comboClinicInput,
    dropdownEl: comboClinicDropdown,
    selectEl: selectClinic,
    getItems: () => allClinicsData,
    defaultPlaceholder: "",
    onSelect: () => {}
  });

  // İl Listesini Çek
  async function loadCitiesList(selectedPlaka) {
    try {
      comboCityInput.placeholder = "İller yükleniyor...";
      comboCityInput.value = "";
      const res = await window.api.loadCities();
      const cities = Array.isArray(res) ? res : (res?.data || []);
      selectCity.innerHTML = "";
      
      if (cities.length === 0) {
        comboCityInput.placeholder = "İller bulunamadı";
        appendLog("warning", "İl listesi boş döndü.");
        return;
      }

      // MHRS API bazen aynı ili (İstanbul, İzmir, Bursa) kurum hiyerarşisi nedeniyle mükerrer döner.
      // value (plaka) bazında tekilleştir (Deduplicate)
      const uniqueCitiesMap = new Map();
      cities.forEach(item => {
        const val = item.value !== undefined ? item.value : item.id;
        if (val !== undefined && !uniqueCitiesMap.has(val)) {
          uniqueCitiesMap.set(val, {
            value: val,
            text: (item.text || item.adi || "").trim()
          });
        }
      });

      const uniqueCities = Array.from(uniqueCitiesMap.values());
      uniqueCities.sort((a, b) => (a.text || "").localeCompare(b.text || "", "tr"));
      allCitiesData = uniqueCities;

      uniqueCities.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.text;
        if (selectedPlaka && String(selectedPlaka) === String(item.value)) {
          opt.selected = true;
          comboCityInput.value = item.text;
        }
        selectCity.appendChild(opt);
      });

      comboCityInput.placeholder = "İl seçin veya yazarak arayın...";
      appendLog("info", `${uniqueCities.length} il başarıyla listelendi.`);

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
      comboDistrictInput.placeholder = "İlçeler yükleniyor...";
      comboDistrictInput.value = "";
      const res = await window.api.loadDistricts(plaka);
      const districts = Array.isArray(res) ? res : (res?.data || []);
      allDistrictsData = districts;
      
      selectDistrict.innerHTML = `<option value="-1">Fark Etmez (Tüm İlçeler)</option>`;
      comboDistrictInput.value = "Fark Etmez (Tüm İlçeler)";

      districts.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.text;
        if (selectedIlce && String(selectedIlce) === String(item.value)) {
          opt.selected = true;
          comboDistrictInput.value = item.text;
        }
        selectDistrict.appendChild(opt);
      });

      comboDistrictInput.placeholder = "İlçe seçin veya yazarak arayın...";
      await loadClinicsList(selectCity.value, selectDistrict.value, config.klinikId);
    } catch (e) {
      appendLog("error", `İlçeler yüklenemedi: ${e.message}`);
    }
  }

  // Klinik Listesini Çek
  async function loadClinicsList(plaka, ilceId, selectedKlinik) {
    try {
      comboClinicInput.placeholder = "Klinikler yükleniyor...";
      comboClinicInput.value = "";
      const res = await window.api.loadClinics(plaka, ilceId);
      const rawClinics = Array.isArray(res) ? res : (res?.data || []);
      
      selectClinic.innerHTML = `<option value="">Klinik Seçiniz...</option>`;
      
      if (rawClinics.length === 0) {
        comboClinicInput.placeholder = "Klinik bulunamadı";
        allClinicsData = [];
        return;
      }

      const clinics = rawClinics.map(item => ({
        id: item.value !== undefined ? item.value : (item.mhrsKlinikId || item.id),
        name: item.text || item.klinikAdi || item.adi || "Bilinmeyen Klinik"
      }));

      clinics.sort((a, b) => a.name.localeCompare(b.name, "tr"));
      allClinicsData = clinics;

      clinics.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        if (selectedKlinik && String(selectedKlinik) === String(item.id)) {
          opt.selected = true;
          comboClinicInput.value = item.name;
        }
        selectClinic.appendChild(opt);
      });

      comboClinicInput.placeholder = "Klinik seçin veya yazarak arayın...";
      appendLog("info", `${clinics.length} klinik yüklendi.`);
    } catch (e) {
      appendLog("error", `Klinikler yüklenemedi: ${e.message}`);
    }
  }

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

      const res = await window.api.startSearch(searchCriteria);
      if (res && res.success === false) {
        alert(`Arama başlatılamadı:\n${res.error}`);
        setRunningState(false);
        return;
      }
      setRunningState(true);
    } else {
      await window.api.stopSearch();
      setRunningState(false);
    }
  });

  function setRunningState(running) {
    isRunning = running;
    
    // Form elemanlarını tarama sırasında kilitle / aç (UI/UX)
    const formControls = [
      inputToken,
      btnSaveToken,
      comboCityInput,
      comboDistrictInput,
      comboClinicInput,
      dateStart,
      dateEnd,
      chkAllDay,
      timeStart,
      timeEnd,
    ];
    formControls.forEach(ctrl => {
      if (ctrl) ctrl.disabled = running;
    });

    quickDateChips.forEach(chip => {
      chip.disabled = running;
      chip.style.pointerEvents = running ? "none" : "auto";
      chip.style.opacity = running ? "0.6" : "1";
    });

    genderCards.forEach(c => {
      c.style.pointerEvents = running ? "none" : "auto";
      c.style.opacity = running ? "0.6" : "1";
    });

    dayPills.forEach(p => {
      p.style.pointerEvents = running ? "none" : "auto";
      p.style.opacity = running ? "0.6" : "1";
    });

    // Eğer tarama durduysa ve Tüm Gün seçiliyse saat kutularını pasif tutmaya devam et
    if (!running && chkAllDay.checked) {
      timeInputsContainer.style.opacity = "0.45";
      timeInputsContainer.style.pointerEvents = "none";
    }

    if (running) {
      statusIndicator.classList.add("running");
      statusText.textContent = "🔍 Taranıyor...";
      statusText.style.color = "#10b981";
      btnToggleSearch.className = "btn-action btn-stop";
      btnToggleSearch.innerHTML = `<span>⏹</span><span>Taramayı Durdur</span>`;
      countdownWidget.style.display = "flex";
    } else {
      statusIndicator.classList.remove("running");
      statusText.textContent = "Beklemede";
      statusText.style.color = "inherit";
      btnToggleSearch.className = "btn-action btn-start";
      btnToggleSearch.innerHTML = `<span>▶</span><span>Taramayı Başlat</span>`;
      countdownWidget.style.display = "none";
      stopCountdownTimer();
    }
  }

  // Döngüsel İlerleme Çubuğu & Canlı Sayaç Mantığı
  let countdownInterval = null;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 15.5; // r=15.5 (~97.389)

  function startCountdownTimer(nextRunAt, totalDelayMs) {
    stopCountdownTimer();
    if (!nextRunAt || !totalDelayMs) {
      countdownStatusText.textContent = "Taranıyor...";
      countdownSecText.textContent = "⌛";
      countdownCircle.style.strokeDashoffset = "0";
      return;
    }

    countdownStatusText.textContent = "Bekleniyor";

    function updateTick() {
      const remainingMs = nextRunAt - Date.now();
      if (remainingMs <= 0) {
        countdownSecText.textContent = "0";
        countdownCircle.style.strokeDashoffset = String(CIRCLE_CIRCUMFERENCE);
        countdownStatusText.textContent = "Taranıyor...";
        stopCountdownTimer();
        return;
      }

      const remainingSec = Math.ceil(remainingMs / 1000);
      countdownSecText.textContent = remainingSec;

      // İlerleme yüzdesi
      const fraction = remainingMs / totalDelayMs;
      const offset = (1 - fraction) * CIRCLE_CIRCUMFERENCE;
      countdownCircle.style.strokeDasharray = String(CIRCLE_CIRCUMFERENCE);
      countdownCircle.style.strokeDashoffset = String(offset);

      if (remainingSec <= 5) {
        countdownCircle.style.stroke = "#ef4444";
      } else if (remainingSec <= 15) {
        countdownCircle.style.stroke = "#f59e0b";
      } else {
        countdownCircle.style.stroke = "#3b82f6";
      }
    }

    updateTick();
    countdownInterval = setInterval(updateTick, 250);
  }

  function stopCountdownTimer() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
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

    if (status.active && status.nextRunAt) {
      startCountdownTimer(status.nextRunAt, status.totalDelayMs);
    } else if (status.active) {
      countdownStatusText.textContent = "Taranıyor...";
      countdownSecText.textContent = "⚡";
    }
  });

  function playSuccessSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (_) {}
  }

  window.api.onAppointmentBooked((appointment) => {
    bookedBanner.style.display = "flex";
    bookedDetails.textContent = `${appointment.hekim} • ${appointment.tarih} (${appointment.hastane})`;
    setRunningState(false);
    playSuccessSound();
  });

  let slotRenderTimeout = null;
  function scheduleGroupedSlotsRender() {
    if (slotRenderTimeout) return;
    slotRenderTimeout = setTimeout(() => {
      slotRenderTimeout = null;
      if (currentLogFilter === "slot") {
        renderGroupedSlotCards();
      }
    }, 150); // 150ms throttle: Yoğun veri akışında arayüzü asla dondurmaz
  }

  window.api.onSlotFound((slot) => {
    // Aynı slot zaten eklenmişse mükerrer ekleme (Tüm slot verisi korunur)
    const exists = discoveredSlotsList.some(s => s.hekim === slot.hekim && s.tarih === slot.tarih && s.hastane === slot.hastane);
    if (!exists) {
      discoveredSlotsList.unshift(slot);
      if (currentLogFilter === "slot") {
        scheduleGroupedSlotsRender();
      }
    }
  });

  // Eğer token varsa açılışta hemen doğrulamayı dene
  if (config.token) {
    btnSaveToken.click();
  }
});
