require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const moment = require("moment");
moment.locale("tr");
const functions = require("./functions.js");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("HATA: TELEGRAM_BOT_TOKEN bulunamadı. Lütfen .env dosyasını kontrol edin.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log("MHRS Telegram Botu başlatıldı ve dinleniyor...");

// Popüler İller (Hızlı erişim için)
const POPULAR_ILLER = [
  { val: 34, name: "İstanbul" },
  { val: 6, name: "Ankara" },
  { val: 35, name: "İzmir" },
  { val: 16, name: "Bursa" },
  { val: 7, name: "Antalya" },
  { val: 1, name: "Adana" },
  { val: 41, name: "Kocaeli" },
  { val: 42, name: "Konya" },
  { val: 27, name: "Gaziantep" },
];

// Popüler Klinik Anahtar Kelimeleri (Hızlı erişim için)
const POPULAR_KLINIK_KEYWORDS = [
  { key: "göz", label: "👁️ Göz" },
  { key: "iç hastalıkları", label: "🩺 Dahiliye" },
  { key: "diş", label: "🦷 Diş" },
  { key: "deri ve zührevi", label: "🔬 Cildiye" },
  { key: "kulak", label: "👂 KBB" },
  { key: "ortopedi", label: "🦴 Ortopedi" },
  { key: "kadın", label: "🤰 Kadın Doğum" },
  { key: "çocuk", label: "👶 Çocuk" },
  { key: "kardiyoloji", label: "💓 Kardiyoloji" },
  { key: "nöroloji", label: "🧠 Nöroloji" },
  { key: "üroloji", label: "🚻 Üroloji" },
  { key: "genel cerrahi", label: "⚕️ Cerrahi" },
];

// Kullanıcı oturumlarını saklama
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      chatId,
      token: null,
      tokenExp: null,
      userName: null,
      state: "IDLE", // IDLE | AWAITING_TOKEN | WIZARD | SEARCHING | AWAITING_SEARCH_TEXT
      temp: {}, // { il, ilce, klinik, cinsiyet, gun }
      cachedIller: null,
      cachedIlceler: null,
      cachedKlinikler: null,
      search: null,
      interval: null,
      attempts: 0,
      lastChecked: null,
      statusMsgId: null, // Güncellenecek mesaj ID'si
    });
  }
  return sessions.get(chatId);
}

function normalizeToken(rawToken) {
  if (!rawToken) return "";
  let t = rawToken.trim();
  if (t.startsWith("Bearer ")) return t;
  return `Bearer ${t}`;
}

function parseTokenExpiry(tokenStr) {
  try {
    const raw = tokenStr.replace("Bearer ", "").trim();
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
  } catch (e) {
    return null;
  }
  return null;
}

function formatRemainingTime(expiryDate) {
  if (!expiryDate) return "Bilinmiyor";
  const diffMs = expiryDate.getTime() - Date.now();
  if (diffMs <= 0) return "Süresi Dolmuş";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} saat ${mins} dakika`;
}

// Yardımcı: Mesajı güvenle düzenle (aynı içerik hatasını yut)
async function safeEditMessage(chatId, messageId, text, replyMarkup) {
  try {
    return await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    });
  } catch (err) {
    if (err.message && err.message.includes("message is not modified")) {
      return null;
    }
    // Düzenlenemiyorsa yeni mesaj olarak gönder
    return await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    });
  }
}

// /start komutu
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  const startArg = match[1]?.trim();

  if (startArg) {
    await processToken(chatId, session, startArg);
    return;
  }

  session.state = "IDLE";

  const text =
    `👋 *MHRS Otomatik Randevu Botuna Hoş Geldiniz!*\n\n` +
    `Bu bot, MHRS'yi sürekli tarayarak istediğiniz poliklinikte randevu açıldığı anda *otomatik olarak alır*.\n\n` +
    `📌 *Kullanım:*\n` +
    `1️⃣ Önce oturum açın: \`/token <token>\`\n` +
    `2️⃣ Butonlarla kolayca randevu ayarlayın: \`/randevu\`\n` +
    `3️⃣ Durumu kontrol edin: \`/durum\`\n` +
    `4️⃣ Taramayı durdurun: \`/durdur\``;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🩺 Randevu Ayarla", callback_data: "cmd_randevu" },
        { text: "📊 Durum", callback_data: "cmd_durum" },
      ],
      [{ text: "🔑 Token Gir", callback_data: "cmd_token_ask" }],
    ],
  };

  bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: replyMarkup });
});

// /token komutu
bot.onText(/\/token(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  const tokenArg = match[1];

  if (!tokenArg) {
    session.state = "AWAITING_TOKEN";
    bot.sendMessage(
      chatId,
      `🔑 Lütfen MHRS *Bearer eyJ...* token'ınızı buraya yapıştırıp gönderin:`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  await processToken(chatId, session, tokenArg);
});

async function processToken(chatId, session, rawInput) {
  rawInput = (rawInput || "").trim();
  let normalized = "";

  // URL veya doğrudan metinden enabizToken algılama
  const urlMatch = rawInput.match(/enabizToken=([a-f0-9\-]{36})/i);
  const uuidMatch = rawInput.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
  const detectedEnabizToken = urlMatch ? urlMatch[1] : (uuidMatch ? uuidMatch[1] : null);

  if (detectedEnabizToken) {
    bot.sendMessage(chatId, "🔄 e-Nabız kodu algılandı, MHRS JWT token'ına dönüştürülüyor...");
    try {
      const loginResp = await functions.enabizTokenIleGiris(detectedEnabizToken);
      const jwt = loginResp?.data?.jwt;
      if (!jwt) throw new Error("MHRS sisteminden JWT alınamadı.");
      if (loginResp?.data?.kullaniciAdi) {
        session.userName = `${loginResp.data.kullaniciAdi} ${loginResp.data.kullaniciSoyadi || ""}`.trim();
      }
      normalized = `Bearer ${jwt}`;
    } catch (e) {
      session.state = "IDLE";
      bot.sendMessage(
        chatId,
        `❌ *Giriş Başarısız:*\n${e.response?.data?.errors?.[0]?.mesaj || e.message}\n` +
          `Lütfen yeni bir kod veya doğrudan Bearer token gönderin.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
  } else {
    normalized = normalizeToken(rawInput);
  }

  bot.sendMessage(chatId, "⏳ Token doğrulanıyor, lütfen bekleyin...");

  try {
    console.log(`[Token Doğrulama] Chat: ${chatId} - MHRS API'ye istek atılıyor...`);
    const randevular = await functions.kullaniciRandevulari(normalized);
    console.log(`[Token Doğrulama BAŞARILI] Chat: ${chatId}`);

    const exp = parseTokenExpiry(normalized);
    session.token = normalized;
    session.tokenExp = exp;
    session.state = "IDLE";

    // Önbellekleri sıfırla
    session.cachedIller = null;
    session.cachedIlceler = null;
    session.cachedKlinikler = null;

    const expText = formatRemainingTime(exp);
    const aktifRandevuSayisi = randevular?.aktifRandevuDtoList?.length ?? 0;
    const nameLine = session.userName ? `👤 *Kullanıcı:* ${session.userName}\n` : "";

    const text =
      `✅ *MHRS Girişi Başarılı!*\n\n` +
      nameLine +
      `⏳ *Kalan Oturum Süresi:* ${expText}\n` +
      `📅 *Mevcut Aktif Randevularınız:* ${aktifRandevuSayisi} adet\n\n` +
      `Aşağıdaki butonla hemen randevu kriterlerinizi seçebilirsiniz:`;

    const replyMarkup = {
      inline_keyboard: [
        [{ text: "🚀 Randevu Aramayı Başlat", callback_data: "cmd_randevu" }],
      ],
    };

    bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: replyMarkup });
  } catch (err) {
    console.error(`[Token Doğrulama HATASI] Chat: ${chatId}:`, {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      headers: err.response?.headers,
      data: err.response?.data,
    });

    console.log(`[MHRS Bağlantı Teşhisi Başlatılıyor...]`);
    const diag = await functions.diagnoseMhrsConnection();
    console.log(`[MHRS Bağlantı Teşhisi Sonucu]:`, JSON.stringify(diag, null, 2));

    session.state = "IDLE";

    const isReset =
      (err.code && err.code.includes("ECONNRESET")) ||
      (diag.tls?.error && diag.tls.error.includes("RESET")) ||
      diag.tls?.code === "ECONNRESET";

    bot.sendMessage(
      chatId,
      `❌ *Token Doğrulanamadı!*\n\n` +
        `• *Hata:* \`${err.message}\` (${err.code || err.response?.status || "Bilinmiyor"})\n\n` +
        `📡 *Sunucu Ağ Teşhisi:*\n` +
        `• *Hedef:* \`${diag.host}\`\n` +
        `• *DNS IP:* ${diag.dns?.success ? `✅ ${diag.dns.ip}` : `❌ ${diag.dns?.error}`}\n` +
        `• *Port 443 / SSL:* ${diag.tls?.success ? `✅ Başarılı (${diag.tls.protocol})` : `❌ ${diag.tls?.error || diag.tls?.code}`}\n\n` +
        (isReset
          ? `⚠️ *Kesin Teşhis:* Sağlık Bakanlığı güvenlik duvarı, Render sunucusunun yurt dışı IP adresini doğrudan engellemektedir (TCP Connection Reset).`
          : ""),
      { parse_mode: "Markdown" }
    );
  }
}

// /ping veya /test komutu (Ağ teşhisi)
bot.onText(/\/ping|\/test/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📡 MHRS sunucu bağlantısı teşhis ediliyor, lütfen bekleyin...");
  console.log(`[/ping] Ağ teşhisi başlatıldı...`);
  const diag = await functions.diagnoseMhrsConnection();
  console.log(`[/ping Sonucu]:`, JSON.stringify(diag, null, 2));

  const isReset =
    (diag.tls?.error && diag.tls.error.includes("RESET")) ||
    diag.tls?.code === "ECONNRESET";

  bot.sendMessage(
    chatId,
    `📡 *MHRS Sunucu Bağlantı Raporu:*\n\n` +
      `• *Hedef:* \`${diag.host}\`\n` +
      `• *DNS Çözümleme:* ${diag.dns?.success ? `✅ Başarılı (${diag.dns.ip})` : `❌ Hata (${diag.dns?.error})`}\n` +
      `• *Port 443 (SSL/TLS):* ${diag.tls?.success ? `✅ Bağlantı Başarılı (${diag.tls.protocol})` : `❌ Bağlantı Kesildi: \`${diag.tls?.error || diag.tls?.code}\``}\n\n` +
      (isReset
        ? `⚠️ *Durum:* Sağlık Bakanlığı, yurt dışı sunucu IP'lerine erişim engeli (Geo-IP Blocking) uygulamaktadır.`
        : ""),
    { parse_mode: "Markdown" }
  );
});


// /randevu komutu
bot.onText(/\/randevu/, async (msg) => {
  startWizard(msg.chat.id);
});

// Sihirbazı Başlat
async function startWizard(chatId, editMessageId = null) {
  const session = getSession(chatId);

  if (!session.token) {
    bot.sendMessage(
      chatId,
      `⚠️ Önce geçerli bir MHRS token'ı girmelisiniz!\nKullanım: \`/token <token>\``,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (session.interval) {
    bot.sendMessage(
      chatId,
      `⚠️ Zaten devam eden bir randevu aramanız var!\nYeni arama için önce durdurun: /durdur`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  session.temp = {};
  session.state = "WIZARD";

  await renderStepIl(chatId, editMessageId, 0);
}

// -----------------------------------------------------------------------------
// ADIM 1: İL SEÇİMİ (Popüler Butonlar + Sayfalı Alfabetik Liste)
// -----------------------------------------------------------------------------
async function renderStepIl(chatId, messageId, pageIndex = 0) {
  const session = getSession(chatId);

  if (!session.cachedIller) {
    try {
      const rawIller = await functions.illeriAl(session.token);
      session.cachedIller = rawIller.sort((a, b) => a.text.localeCompare(b.text, "tr"));
    } catch (e) {
      bot.sendMessage(chatId, `❌ İller listesi alınamadı: ${e.message}`);
      return;
    }
  }

  const iller = session.cachedIller;
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(iller.length / PAGE_SIZE);
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));

  const pageIller = iller.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const keyboard = [];

  // Popüler İller (İlk sayfada göster)
  if (currentPage === 0) {
    keyboard.push([
      { text: "🏢 İstanbul", callback_data: "sel_il_34" },
      { text: "🏛️ Ankara", callback_data: "sel_il_6" },
      { text: "🌊 İzmir", callback_data: "sel_il_35" },
    ]);
    keyboard.push([
      { text: "🌿 Bursa", callback_data: "sel_il_16" },
      { text: "☀️ Antalya", callback_data: "sel_il_7" },
      { text: "🌾 Adana", callback_data: "sel_il_1" },
    ]);
    keyboard.push([
      { text: "🏭 Kocaeli", callback_data: "sel_il_41" },
      { text: "🕌 Konya", callback_data: "sel_il_42" },
      { text: "🏰 Gaziantep", callback_data: "sel_il_27" },
    ]);
  }

  // Sayfalanan İller (2'şerli butonlar)
  for (let i = 0; i < pageIller.length; i += 2) {
    const row = [{ text: pageIller[i].text, callback_data: `sel_il_${pageIller[i].value}` }];
    if (i + 1 < pageIller.length) {
      row.push({ text: pageIller[i + 1].text, callback_data: `sel_il_${pageIller[i + 1].value}` });
    }
    keyboard.push(row);
  }

  // Sayfalama kontrolleri
  const navRow = [];
  if (currentPage > 0) {
    navRow.push({ text: "◀️ Önceki", callback_data: `page_il_${currentPage - 1}` });
  }
  navRow.push({ text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: "noop" });
  if (currentPage < totalPages - 1) {
    navRow.push({ text: "Sonraki ▶️", callback_data: `page_il_${currentPage + 1}` });
  }
  keyboard.push(navRow);

  // İptal Butonu
  keyboard.push([{ text: "❌ İptal Et", callback_data: "wizard_cancel" }]);

  const text =
    `📍 *1/5 Adım: Randevu İstediğiniz İli Seçin*\n\n` +
    `Popüler illerden birine dokunun veya aşağıdaki listeden sayfa değiştirerek ilinizi seçin:`;

  if (messageId) {
    await safeEditMessage(chatId, messageId, text, { inline_keyboard: keyboard });
  } else {
    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
    session.statusMsgId = sent.message_id;
  }
}

// -----------------------------------------------------------------------------
// ADIM 2: İLÇE SEÇİMİ (Tüm İl + Dinamik İlçe Butonları)
// -----------------------------------------------------------------------------
async function renderStepIlce(chatId, messageId, pageIndex = 0) {
  const session = getSession(chatId);
  const il = session.temp.il;

  if (!session.cachedIlceler || session.cachedIlcelerIlId !== il.value) {
    try {
      const rawIlceler = await functions.ilinIlceleri(session.token, il.value);
      session.cachedIlceler = rawIlceler.sort((a, b) => a.text.localeCompare(b.text, "tr"));
      session.cachedIlcelerIlId = il.value;
    } catch (e) {
      bot.sendMessage(chatId, `❌ İlçeler listesi alınamadı: ${e.message}`);
      return;
    }
  }

  const ilceler = session.cachedIlceler;
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(ilceler.length / PAGE_SIZE) || 1;
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));

  const pageIlceler = ilceler.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const keyboard = [];

  // En üstte "Tüm İl (Fark Etmez)" seçeneği
  keyboard.push([{ text: `🌐 ${il.text} Genelinde Ara (Fark Etmez)`, callback_data: "sel_ilce_f" }]);

  // İlçeler (2'şerli sütun)
  for (let i = 0; i < pageIlceler.length; i += 2) {
    const row = [{ text: pageIlceler[i].text, callback_data: `sel_ilce_${pageIlceler[i].value}` }];
    if (i + 1 < pageIlceler.length) {
      row.push({ text: pageIlceler[i + 1].text, callback_data: `sel_ilce_${pageIlceler[i + 1].value}` });
    }
    keyboard.push(row);
  }

  // Sayfalama (gerekirse)
  if (totalPages > 1) {
    const navRow = [];
    if (currentPage > 0) {
      navRow.push({ text: "◀️ Önceki", callback_data: `page_ilce_${currentPage - 1}` });
    }
    navRow.push({ text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: "noop" });
    if (currentPage < totalPages - 1) {
      navRow.push({ text: "Sonraki ▶️", callback_data: `page_ilce_${currentPage + 1}` });
    }
    keyboard.push(navRow);
  }

  // Geri Butonu
  keyboard.push([{ text: "◀️ İl Değiştir", callback_data: "back_to_il" }]);

  const text =
    `🏙 *2/5 Adım: İlçe Seçimi*\n\n` +
    `Seçilen İl: *${il.text}*\n\n` +
    `Tüm ilde aramak için en üstteki butona dokunun veya belirli bir ilçe seçin:`;

  await safeEditMessage(chatId, messageId, text, { inline_keyboard: keyboard });
}

// -----------------------------------------------------------------------------
// ADIM 3: KLİNİK SEÇİMİ (Popüler Klinikler + Sayfalı Liste)
// -----------------------------------------------------------------------------
async function renderStepKlinik(chatId, messageId, pageIndex = 0) {
  const session = getSession(chatId);
  const il = session.temp.il;
  const ilceId = session.temp.ilce === "f" ? -1 : session.temp.ilce.value;

  const cacheKey = `${il.value}_${ilceId}`;
  if (!session.cachedKlinikler || session.cachedKliniklerKey !== cacheKey) {
    try {
      const rawKlinikler = await functions.klinikleriAl(session.token, il.value, ilceId);
      session.cachedKlinikler = rawKlinikler.sort((a, b) => a.text.localeCompare(b.text, "tr"));
      session.cachedKliniklerKey = cacheKey;
    } catch (e) {
      bot.sendMessage(chatId, `❌ Klinikler listesi alınamadı: ${e.message}`);
      return;
    }
  }

  const klinikler = session.cachedKlinikler;
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(klinikler.length / PAGE_SIZE) || 1;
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));

  const keyboard = [];

  // İlk sayfada popüler klinikler
  if (currentPage === 0) {
    const popRows = [];
    let currentRow = [];
    for (const pop of POPULAR_KLINIK_KEYWORDS) {
      const found = klinikler.find((k) =>
        functions.yaziSadele(k.text).includes(functions.yaziSadele(pop.key))
      );
      if (found) {
        currentRow.push({ text: pop.label, callback_data: `sel_kl_${found.value}` });
        if (currentRow.length === 3) {
          popRows.push(currentRow);
          currentRow = [];
        }
      }
    }
    if (currentRow.length > 0) popRows.push(currentRow);
    keyboard.push(...popRows);
  }

  // Sayfalanan Genel Klinik Listesi
  const pageKlinikler = klinikler.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  for (let i = 0; i < pageKlinikler.length; i += 2) {
    const row = [{ text: pageKlinikler[i].text, callback_data: `sel_kl_${pageKlinikler[i].value}` }];
    if (i + 1 < pageKlinikler.length) {
      row.push({ text: pageKlinikler[i + 1].text, callback_data: `sel_kl_${pageKlinikler[i + 1].value}` });
    }
    keyboard.push(row);
  }

  // Sayfalama kontrolleri
  if (totalPages > 1) {
    const navRow = [];
    if (currentPage > 0) {
      navRow.push({ text: "◀️ Önceki", callback_data: `page_kl_${currentPage - 1}` });
    }
    navRow.push({ text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: "noop" });
    if (currentPage < totalPages - 1) {
      navRow.push({ text: "Sonraki ▶️", callback_data: `page_kl_${currentPage + 1}` });
    }
    keyboard.push(navRow);
  }

  // Arama ve Geri butonu
  keyboard.push([
    { text: "🔍 İsimle Ara", callback_data: "search_kl_prompt" },
    { text: "◀️ İlçe Değiştir", callback_data: "back_to_ilce" },
  ]);

  const ilceAdi = session.temp.ilce === "f" ? "Fark Etmez" : session.temp.ilce.text;
  const text =
    `🩺 *3/5 Adım: Poliklinik (Klinik) Seçimi*\n\n` +
    `Konum: *${il.text} / ${ilceAdi}*\n\n` +
    `En çok tercih edilen kliniklerden birine dokunun veya sayfa değiştirerek aradığınız branşı seçin:`;

  await safeEditMessage(chatId, messageId, text, { inline_keyboard: keyboard });
}

// -----------------------------------------------------------------------------
// ADIM 4: HEKİM CİNSİYETİ
// -----------------------------------------------------------------------------
async function renderStepCinsiyet(chatId, messageId) {
  const session = getSession(chatId);

  const keyboard = [
    [
      { text: "👨 Erkek Hekim", callback_data: "sel_cins_E" },
      { text: "👩 Kadın Hekim", callback_data: "sel_cins_K" },
    ],
    [{ text: "⚧ Fark Etmez (Önerilen)", callback_data: "sel_cins_F" }],
    [{ text: "◀️ Klinik Değiştir", callback_data: "back_to_kl" }],
  ];

  const text =
    `👤 *4/5 Adım: Hekim Cinsiyet Tercihi*\n\n` +
    `Klinik: *${session.temp.klinik.text}*\n\n` +
    `Lütfen hekim cinsiyet tercihinizi seçin (Randevu bulma şansını artırmak için *Fark Etmez* önerilir):`;

  await safeEditMessage(chatId, messageId, text, { inline_keyboard: keyboard });
}

// -----------------------------------------------------------------------------
// ADIM 5: TARİH ARALIĞI (GÜN)
// -----------------------------------------------------------------------------
async function renderStepGun(chatId, messageId) {
  const session = getSession(chatId);

  const keyboard = [
    [
      { text: "⚡ Önümüzdeki 3 Gün", callback_data: "sel_gun_3" },
      { text: "📅 Önümüzdeki 7 Gün", callback_data: "sel_gun_7" },
    ],
    [
      { text: "🗓️ Önümüzdeki 10 Gün", callback_data: "sel_gun_10" },
      { text: "📆 Önümüzdeki 15 Gün", callback_data: "sel_gun_15" },
    ],
    [{ text: "◀️ Cinsiyet Değiştir", callback_data: "back_to_cins" }],
  ];

  const text =
    `📅 *5/5 Adım: Zaman Aralığı*\n\n` +
    `Önümüzdeki kaç gün içerisindeki uygun randevular aransın?`;

  await safeEditMessage(chatId, messageId, text, { inline_keyboard: keyboard });
}

// -----------------------------------------------------------------------------
// ADIM 6: ÖZET VE ONAY KARTI
// -----------------------------------------------------------------------------
async function renderSummary(chatId, messageId) {
  const session = getSession(chatId);
  const s = session.temp;

  const ilceAdi = s.ilce === "f" ? "Fark Etmez (Tüm İl)" : s.ilce.text;
  const cinsiyetStr = s.cinsiyet === "E" ? "Erkek" : s.cinsiyet === "K" ? "Kadın" : "Fark Etmez";

  const keyboard = [
    [{ text: "🚀 Taramayı Başlat", callback_data: "start_search_now" }],
    [{ text: "🔄 Baştan Seç", callback_data: "cmd_randevu" }],
    [{ text: "❌ İptal Et", callback_data: "wizard_cancel" }],
  ];

  const text =
    `📋 *Randevu Arama Kriterleriniz:*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📍 *İl:* ${s.il.text}\n` +
    `🏙 *İlçe:* ${ilceAdi}\n` +
    `🩺 *Klinik:* ${s.klinik.text}\n` +
    `👤 *Hekim Cinsiyeti:* ${cinsiyetStr}\n` +
    `📅 *Zaman Aralığı:* Önümüzdeki ${s.gun} gün\n` +
    `⏱️ *Tarama Sıklığı:* Her 1 dakikada bir\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `Taramayı başlatmak için aşağıdaki butona dokunun:`;

  await safeEditMessage(chatId, messageId, text, { inline_keyboard: keyboard });
}

// -----------------------------------------------------------------------------
// ADIM 7: CANLI KONTROL PANELİ (DASHBOARD)
// -----------------------------------------------------------------------------
async function renderDashboard(chatId, messageId) {
  const session = getSession(chatId);
  if (!session.search || session.state !== "SEARCHING") return;

  const s = session.search;
  const ilceAdi = s.ilce === "f" ? "Tüm İl" : s.ilce.text;
  const sonKontrolStr = session.lastChecked
    ? moment(session.lastChecked).format("HH:mm:ss")
    : "İlk kontrol yapılıyor...";

  const keyboard = [
    [
      { text: "🛑 Taramayı Durdur", callback_data: "stop_search_now" },
      { text: "🔄 Şimdi Kontrol Et", callback_data: "force_check_now" },
    ],
  ];

  const durumMesaji = session.lastStatus || "🔍 Boş slot aranıyor... (Her 1 dk'da bir kontrol ediliyor)";

  const text =
    `🔄 *MHRS Randevu Taraması Aktif*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Hedef:* ${s.il.text} / ${ilceAdi}\n` +
    `🩺 *Klinik:* ${s.klinik.text}\n` +
    `🔢 *Deneme Sayısı:* ${session.attempts}\n` +
    `⏱️ *Son Kontrol:* ${sonKontrolStr}\n` +
    `⏳ *Token Kalan Süre:* ${formatRemainingTime(session.tokenExp)}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Durum: ${durumMesaji}`;


  if (messageId) {
    await safeEditMessage(chatId, messageId, text, { inline_keyboard: keyboard });
  } else {
    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
    session.statusMsgId = sent.message_id;
  }
}

// -----------------------------------------------------------------------------
// BUTON TIKLAMALARINI (CALLBACK_QUERY) YÖNETME
// -----------------------------------------------------------------------------
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const session = getSession(chatId);

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (data === "noop") return;

  // Komut Butonları
  if (data === "cmd_randevu") {
    return startWizard(chatId, messageId);
  }
  if (data === "cmd_durum") {
    return bot.sendMessage(
      chatId,
      session.interval ? "🔄 Aktif tarama var." : "⏸ Sistem boşta.",
      { parse_mode: "Markdown" }
    );
  }
  if (data === "cmd_token_ask") {
    session.state = "AWAITING_TOKEN";
    return bot.sendMessage(chatId, `🔑 Lütfen MHRS Bearer token'ınızı yapıştırın:`);
  }
  if (data === "wizard_cancel") {
    session.state = "IDLE";
    session.temp = {};
    return safeEditMessage(chatId, messageId, "🚫 Randevu seçimi iptal edildi.", {
      inline_keyboard: [[{ text: "🩺 Yeniden Başlat", callback_data: "cmd_randevu" }]],
    });
  }

  // İL SEÇİMİ VE SAYFALAMA
  if (data.startsWith("sel_il_")) {
    const rawVal = data.replace("sel_il_", "").trim();
    if (!session.cachedIller) {
      try {
        session.cachedIller = await functions.illeriAl(session.token);
      } catch (e) {}
    }
    const secilen = session.cachedIller?.find(
      (a) => String(a.value) === rawVal || a.value == rawVal
    );
    session.temp.il = secilen || { value: Number(rawVal) || rawVal, text: `İl (${rawVal})` };
    return renderStepIlce(chatId, messageId, 0);
  }
  if (data.startsWith("page_il_")) {
    const page = Number(data.replace("page_il_", ""));
    return renderStepIl(chatId, messageId, page);
  }

  // İLÇE SEÇİMİ VE SAYFALAMA
  if (data.startsWith("sel_ilce_")) {
    const rawVal = data.replace("sel_ilce_", "").trim();
    if (rawVal === "f") {
      session.temp.ilce = "f";
    } else {
      if (!session.cachedIlceler && session.temp.il) {
        try {
          session.cachedIlceler = await functions.ilinIlceleri(session.token, session.temp.il.value);
        } catch (e) {}
      }
      const secilen = session.cachedIlceler?.find(
        (a) => String(a.value) === rawVal || a.value == rawVal
      );
      if (secilen) {
        session.temp.ilce = secilen;
      } else {
        session.temp.ilce = { value: Number(rawVal) || rawVal, text: `İlçe (${rawVal})` };
      }
    }
    return renderStepKlinik(chatId, messageId, 0);
  }
  if (data.startsWith("page_ilce_")) {
    const page = Number(data.replace("page_ilce_", ""));
    return renderStepIlce(chatId, messageId, page);
  }
  if (data === "back_to_il") {
    return renderStepIl(chatId, messageId, 0);
  }

  // KLİNİK SEÇİMİ VE SAYFALAMA
  if (data.startsWith("sel_kl_")) {
    const rawVal = data.replace("sel_kl_", "").trim();
    const secilen = session.cachedKlinikler?.find(
      (a) => String(a.value) === rawVal || a.value == rawVal
    );
    session.temp.klinik = secilen || { value: Number(rawVal) || rawVal, text: `Klinik (${rawVal})` };
    return renderStepCinsiyet(chatId, messageId);
  }
  if (data.startsWith("page_kl_")) {
    const page = Number(data.replace("page_kl_", ""));
    return renderStepKlinik(chatId, messageId, page);
  }
  if (data === "back_to_ilce") {
    return renderStepIlce(chatId, messageId, 0);
  }

  if (data === "search_kl_prompt") {
    session.state = "AWAITING_SEARCH_TEXT";
    session.searchMsgId = messageId;
    return bot.sendMessage(
      chatId,
      `🔍 Aramak istediğiniz klinik adını veya birkaç harfini yazıp gönderin (Örn: \`Göz\`, \`Dahiliye\`, \`Cildiye\`):`,
      { parse_mode: "Markdown" }
    );
  }

  // CİNSİYET SEÇİMİ
  if (data.startsWith("sel_cins_")) {
    session.temp.cinsiyet = data.replace("sel_cins_", "");
    return renderStepGun(chatId, messageId);
  }
  if (data === "back_to_kl") {
    return renderStepKlinik(chatId, messageId, 0);
  }

  // GÜN SEÇİMİ
  if (data.startsWith("sel_gun_")) {
    session.temp.gun = Number(data.replace("sel_gun_", ""));
    return renderSummary(chatId, messageId);
  }
  if (data === "back_to_cins") {
    return renderStepCinsiyet(chatId, messageId);
  }

  // TARAMAYI BAŞLATMA
  if (data === "start_search_now") {
    session.search = { ...session.temp };
    session.temp = {};
    session.state = "SEARCHING";
    session.attempts = 0;
    session.lastChecked = null;
    session.statusMsgId = messageId;

    await renderDashboard(chatId, messageId);

    // İlk kontrolü anında yap
    taramaYap(chatId);

    // 1 dakikalık döngüyü kur
    if (session.interval) clearInterval(session.interval);
    session.interval = setInterval(() => {
      taramaYap(chatId);
    }, 60000);

    return;
  }

  // TARAMAYI DURDURMA
  if (data === "stop_search_now") {
    if (session.interval) {
      clearInterval(session.interval);
      session.interval = null;
    }
    session.state = "IDLE";

    const text =
      `🛑 *Tarama Durduruldu!*\n\n` +
      `Toplam *${session.attempts}* kontrol yapıldı.\n` +
      `Yeniden randevu aramak için aşağıdaki butona dokunabilirsiniz:`;

    const replyMarkup = {
      inline_keyboard: [[{ text: "🩺 Yeni Randevu Ara", callback_data: "cmd_randevu" }]],
    };

    return safeEditMessage(chatId, messageId, text, replyMarkup);
  }

  // ZORLA KONTROL ET (Manuel Tetik)
  if (data === "force_check_now") {
    taramaYap(chatId);
    return;
  }
});

// -----------------------------------------------------------------------------
// METİN GİRİŞLERİNİ DİNLEME (Arama & Token)
// -----------------------------------------------------------------------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith("/")) return;

  const session = getSession(chatId);

  // 1. Token Girişi
  if (session.state === "AWAITING_TOKEN") {
    await processToken(chatId, session, text);
    return;
  }

  // 2. Klinik İsimle Arama
  if (session.state === "AWAITING_SEARCH_TEXT" && session.cachedKlinikler) {
    const sade = functions.yaziSadele(text);
    const matches = session.cachedKlinikler.filter((k) =>
      functions.yaziSadele(k.text).includes(sade)
    );

    if (matches.length === 0) {
      bot.sendMessage(
        chatId,
        `❌ *${text}* ile eşleşen bir klinik bulunamadı. Lütfen tekrar deneyin:`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (matches.length === 1) {
      session.temp.klinik = matches[0];
      session.state = "WIZARD";
      bot.sendMessage(chatId, `✅ *${matches[0].text}* seçildi.`);
      return renderStepCinsiyet(chatId, null);
    }

    // Birden fazla eşleşme varsa buton olarak sun
    const buttons = matches.slice(0, 10).map((m) => [
      { text: m.text, callback_data: `sel_kl_${m.value}` },
    ]);
    buttons.push([{ text: "◀️ Listeye Dön", callback_data: "page_kl_0" }]);

    session.state = "WIZARD";
    bot.sendMessage(
      chatId,
      `🔎 *${text}* için bulunan sonuçlar:\nLütfen birine dokunun:`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons },
      }
    );
    return;
  }
});

// /durum komutu
bot.onText(/\/durum/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);

  if (session.interval && session.search) {
    renderDashboard(chatId, null);
  } else {
    const tokenStr = session.token
      ? `✅ Aktif (${formatRemainingTime(session.tokenExp)})`
      : `❌ Tanımlı Değil`;

    const text =
      `📊 *Sistem Durumu:*\n\n` +
      `• *Arama Durumu:* ⏸ Boşta / Çalışmıyor\n` +
      `• *MHRS Token:* ${tokenStr}\n\n` +
      `Randevu aramak için aşağıdaki butona dokunabilirsiniz:`;

    const replyMarkup = {
      inline_keyboard: [[{ text: "🩺 Randevu Ayarla", callback_data: "cmd_randevu" }]],
    };

    bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: replyMarkup });
  }
});

// /durdur komutu
bot.onText(/\/durdur/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);

  if (session.interval) {
    clearInterval(session.interval);
    session.interval = null;
    session.state = "IDLE";
    bot.sendMessage(
      chatId,
      `🛑 *Tarama Durduruldu!*\nToplam *${session.attempts}* kontrol yapıldı.`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🩺 Yeniden Başlat", callback_data: "cmd_randevu" }]],
        },
      }
    );
  } else {
    bot.sendMessage(chatId, `ℹ️ Zaten çalışan aktif bir randevu arama işlemi yok.`);
  }
});

// -----------------------------------------------------------------------------
// ARKA PLAN TARAMA MOTORU (Polling & Auto-Booking)
// -----------------------------------------------------------------------------
async function taramaYap(chatId) {
  const session = getSession(chatId);
  if (!session.token || !session.search || session.state !== "SEARCHING") return;

  const s = session.search;
  session.attempts++;
  session.lastChecked = new Date();

  console.log(`[Chat ${chatId}] Randevu aranıyor (${session.attempts}. deneme) - ${s.klinik.text}`);

  // Kontrol panelini güncelle
  if (session.statusMsgId) {
    renderDashboard(chatId, session.statusMsgId).catch(() => {});
  }

  try {
    // 1. Zaten aktif randevu var mı?
    const randevular = await functions.kullaniciRandevulari(session.token);
    const mevcutRandevu = randevular?.aktifRandevuDtoList?.some(
      (a) => a.mhrsKlinikAdi === s.klinik.text && a.randevuKayitDurumu.val !== 4
    );

    if (mevcutRandevu) {
      clearInterval(session.interval);
      session.interval = null;
      session.state = "IDLE";

      bot.sendMessage(
        chatId,
        `⚠️ *Dikkat:* Zaten bu klinikte (${s.klinik.text}) aktif bir randevunuz bulunduğu için tarama otomatik olarak durduruldu.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // 2. Randevu ara
    const baslangicTarihi = moment().format("YYYY-MM-DD HH:mm:ss");
    const bitisTarihi = moment().add(Number(s.gun), "days").format("YYYY-MM-DD HH:mm:ss");
    const ilceId = s.ilce === "f" ? -1 : s.ilce.value;

    const randevuVerisi = await functions.randevuAra(
      session.token,
      s.il.value,
      ilceId,
      s.cinsiyet,
      s.klinik.value,
      baslangicTarihi,
      bitisTarihi
    );

    if (!randevuVerisi?.hastane || randevuVerisi.hastane.length === 0) {
      session.lastStatus = "❌ Uygun randevu bulunamadı, bekleniyor...";
      if (session.statusMsgId) {
        renderDashboard(chatId, session.statusMsgId).catch(() => {});
      }
      return; // Randevu yok, devam
    }

    // 3. En yakın tarihli hastaneyi seç
    const enYakinHastane = randevuVerisi.hastane.sort(
      (a, b) => new Date(a.baslangicZamani).getTime() - new Date(b.baslangicZamani).getTime()
    )[0];

    // 4. Hekim slotlarını sorgula
    const hekimVerisi = await functions.hekimAra(
      session.token,
      s.il.value,
      s.cinsiyet,
      s.klinik.value,
      enYakinHastane.kurum.mhrsKurumId,
      enYakinHastane.hekim.mhrsHekimId
    );

    const kullanilabilirHekimler = hekimVerisi.filter((hekim) => hekim.kalanKullanim > 0);

    if (kullanilabilirHekimler.length > 0) {
      for (const hekim of kullanilabilirHekimler) {
        const saatler =
          hekim.hekimSlotList[0]?.muayeneYeriSlotList[0]?.saatSlotList?.filter(
            (saat) => saat.bos === true
          ) || [];

        const slotList = [];
        for (const saat of saatler) {
          for (const slotKey in saat.slotList) {
            slotList.push(saat.slotList[slotKey]);
          }
        }

        const alinabilirSlotlar = slotList.filter((a) => a.bos === true);

        if (alinabilirSlotlar.length > 0) {
          const alinacakSlot = alinabilirSlotlar[0].slot;

          // 5. Randevuyu AL!
          const resp = await functions.randevuAl(
            session.token,
            alinacakSlot.id,
            alinacakSlot.fkCetvelId,
            alinacakSlot.baslangicZamani,
            alinacakSlot.bitisZamani
          );

          // Başarılı!
          clearInterval(session.interval);
          session.interval = null;
          session.state = "IDLE";
          session.lastStatus = "🎉 Randevu Başarıyla Alındı!";

          const hekimAdi = `${resp.hekim?.ad || ""} ${resp.hekim?.soyad || ""}`.trim();
          const kurumAdi = resp.kurum?.kurumAdi || enYakinHastane.kurum.kurumAdi;
          const konumStr = `${resp.kurum?.ilAdi || s.il.text} / ${resp.kurum?.ilceAdi || ""}`;
          const tarihStr = resp.randevuBaslangicZamaniStr?.zaman || alinacakSlot.baslangicZamani;
          const saatStr = `${resp.randevuBaslangicZamaniStr?.saat || ""} - ${resp.randevuBitisZamaniStr?.saat || ""}`;

          bot.sendMessage(
            chatId,
            `🎉🎉 *RANDEVUNUZ BAŞARIYLA ALINDI!* 🎉🎉\n\n` +
              `👨‍⚕️ *Hekim:* ${hekimAdi}\n` +
              `🏥 *Kurum:* ${kurumAdi}\n` +
              `📍 *Konum:* ${konumStr}\n` +
              `📅 *Tarih:* ${tarihStr}\n` +
              `⏰ *Saat:* ${saatStr}\n\n` +
              `Toplam *${session.attempts}* deneme sonunda randevu başarıyla alındı ve tarama tamamlandı!`,
            { parse_mode: "Markdown" }
          );

          console.log(`[Chat ${chatId}] Randevu başarıyla alındı! Hekim: ${hekimAdi}`);
          return;
        }
      }
    }

    session.lastStatus = "❌ Hekim bulundu fakat uygun slot yok, bekleniyor...";
    if (session.statusMsgId) {
      renderDashboard(chatId, session.statusMsgId).catch(() => {});
    }
  } catch (err) {
    if (err.response?.status === 401) {
      clearInterval(session.interval);
      session.interval = null;
      session.state = "IDLE";
      session.token = null;
      session.lastStatus = "⚠️ Oturum Süresi Doldu";

      bot.sendMessage(
        chatId,
        `⚠️ *Oturum Süreniz Doldu!*\n\n` +
          `MHRS oturumunuzun süresi sona erdi. Tarama durduruldu.\n` +
          `Lütfen yeni bir token girin: \`/token <yeni_token>\``,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (err.response?.data?.errors?.[0]?.kodu === "RND4010") {
      session.lastStatus = "❌ Uygun randevu bulunamadı, bekleniyor...";
      if (session.statusMsgId) {
        renderDashboard(chatId, session.statusMsgId).catch(() => {});
      }
      return;
    }

    // Beklenmeyen API Hatası
    const errDetail =
      err.response?.data?.errors?.[0]?.mesaj ||
      err.response?.data?.message ||
      err.message ||
      "Bilinmeyen API Hatası";
    const errCode = err.response?.data?.errors?.[0]?.kodu || err.response?.status || "HATA";

    session.lastStatus = `⚠️ Hata [${errCode}]: ${errDetail}`;
    if (session.statusMsgId) {
      renderDashboard(chatId, session.statusMsgId).catch(() => {});
    }

    bot.sendMessage(
      chatId,
      `⚠️ *MHRS API Hatası Alındı (${session.attempts}. Deneme):*\n\n` +
        `• *Hata Kodu:* \`${errCode}\`\n` +
        `• *Detay:* \`${errDetail}\`\n\n` +
        `Sistem durdurulmadı, 1 dakika sonra tekrar denemeye devam edecek. Taramayı iptal etmek isterseniz /durdur yazabilirsiniz.`,
      { parse_mode: "Markdown" }
    );

    console.error(`[Chat ${chatId}] Randevu kontrol hatası:`, err.message);
  }
}

