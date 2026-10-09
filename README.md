# MHRS Otomatik Randevu (Telegram Bot)

MHRS (Merkezi Hekim Randevu Sistemi) üzerinde poliklinik randevularını sürekli tarayan ve uygun slot bulunduğunda otomatik olarak alan Telegram botu.

Bu proje doğrudan bir web sunucusunda veya bilgisayarınızda arka planda çalışabilir; tüm kontroller telefonunuzdan Telegram mesajlarıyla yapılır.

---

## 🚀 Özellikler

- **📱 %100 Telegram Üzerinden Yönetim:** İl, ilçe, klinik, hekim cinsiyeti ve gün aralığı Telegram sohbeti üzerinden interaktif sihirbazla seçilir.
- **⚡ Otomatik Randevu Alma:** Kriterlere uyan randevu açıldığı anda otomatik onaylanır ve randevu detayları (Hekim, Kurum, Tarih, Saat) Telegram bildirimi olarak iletilir.
- **🛡️ Cloudflare & Turnstile Bağımsız:** Giriş e-Nabız üzerinden tarayıcıda yapıldığı için sunucuda Cloudflare engeline veya SMS OTP zorluklarına takılmaz.
- **⏳ 20 Saat Kesintisiz Tarama:** MHRS Bearer token'ları tek seferde 20 saat geçerlidir.

---

## 🛠️ Kurulum

1. Depoyu klonlayın veya indirin:
   ```bash
   git clone <repo-url>
   cd mhrs-otorandevu
   ```

2. Bağımlılıkları kurun:
   ```bash
   npm install
   ```

3. `.env` dosyasını oluşturun ve Telegram Bot Token'ınızı ekleyin:
   ```env
   TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
   ```

4. Botu başlatın:
   ```bash
   npm start
   ```

*(Sunucuda 7/24 arka planda çalıştırmak için `pm2 start bot.js --name mhrs-bot` kullanabilirsiniz.)*

---

## 📲 Telefondan Token Alma (Tek Tıkla Yer İmi)

Telefonda F12 Geliştirici Araçları olmadığı için token'ı kolayca almak amacıyla tarayıcınıza (Chrome/Safari) şu yer imini (bookmarklet) ekleyin:

1. Tarayıcınızda herhangi bir sayfayı yer imlerine kaydedin ve adını **"MHRS Token Kopyala"** yapın.
2. Adres (URL) alanına şu kodu yapıştırın:
   ```javascript
   javascript:(function(){const t=localStorage.getItem('token')||sessionStorage.getItem('token');if(t){navigator.clipboard.writeText(t);alert('✅ Token panoya kopyalandı! Telegram bota yapıştırabilirsiniz.');}else{alert('❌ Token bulunamadı. Lütfen önce MHRS oturumunuzu açın.');}})();
   ```
3. e-Nabız üzerinden MHRS ana sayfasına giriş yaptıktan sonra bu yer imine tıklayın. Token panoya kopyalanacaktır.
4. Telegram'da bota `/token <kopyalanan_token>` yazarak gönderin.

---

## 🤖 Telegram Bot Komutları

| Komut | Açıklama |
|---|---|
| `/start` | Botu başlatır ve hoş geldin rehberini gösterir. |
| `/token <token>` | MHRS Bearer token'ınızı kaydeder ve süresini doğrular. |
| `/randevu` | Adım adım il, ilçe, klinik ve tarih kriterlerini seçtirip taramayı başlatır. |
| `/durum` | Aktif taramanın durumunu, deneme sayısını ve kalan token süresini raporlar. |
| `/durdur` | Aktif randevu aramasını durdurur. |
| `/iptal` | Devam eden yapılandırma sihirbazını iptal eder. |
| `/yardim` | Komut yardım listesini gösterir. |
