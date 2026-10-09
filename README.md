# 🩺 MHRS Otomatik Randevu Asistanı (Windows Masaüstü Uygulaması)

T.C. Sağlık Bakanlığı MHRS (Merkezi Hekim Randevu Sistemi) için geliştirilmiş modern, hafif ve arka planda sessizce çalışan Windows masaüstü randevu yakalama asistanı.

İstediğiniz il, ilçe, poliklinik, hekim cinsiyeti, kabul edilen günler ve saat aralığı kriterlerine göre MHRS'yi sürekli tarar; boş slot açıldığı anda randevunuzu otomatik olarak alır ve Windows masaüstü bildirimi gönderir.

---

## ✨ Özellikler

- 🏥 **Resmi MHRS Temalı Modern Arayüz:** Sade, temiz ve resmi MHRS renk paleti (`#c62828`).
- 📍 **Akıllı ve Kademeli Filtreleme:**
  - **İl ve İlçe Seçimi:** Alfabetik sıralı tüm iller ve seçilen ile ait dinamik ilçe listesi ("Fark Etmez / Tüm İlçeler" desteği).
  - **Poliklinik (Klinik):** Seçilen konuma göre aktif poliklinikler.
  - **Hekim Cinsiyeti:** Fark Etmez / Kadın / Erkek.
  - **Tarih Aralığı:** Başlangıç ve bitiş takvimi.
  - **Kabul Edilen Günler:** Haftanın istenen günleri (Pazartesi - Pazar).
  - **Saat Dilimi Filtresi:** İstenen saat aralığı (örn: `09:00 - 12:30`) veya saat sınırı olmadan ilk randevuyu yakalayan **"Tüm Gün (Fark Etmez)"** modu.
- 🔕 **Sistem Tepsisi (System Tray):**
  - Pencere simge durumuna küçültüldüğünde (`−`) veya kapatıldığında (`✕`) görev çubuğunu işgal etmez; doğrudan sağ alttaki **Gizli Simgeler (Tray)** alanına gizlenir.
  - Tepsideki MHRS logosuna çift tıklayarak pencereyi anında geri açabilir, sağ tık menüsünden taramayı yönetebilir veya çıkış yapabilirsiniz.
- 🔔 **Windows Masaüstü Bildirimleri (Toast):**
  - Randevu başarıyla onaylandığında Windows sağ alt köşesinde sesli toast bildirimi patlar (Hekim adı, hastane ve saat bilgisiyle).
- 💻 **Canlı Konsol (Terminal):**
  - Taranan slotları, deneme sayılarını ve durumu milisaniyelik anlık akıtır.
  - Log metinleri fareyle **seçilebilir ve kopyalanabilir** (`Ctrl + C`).
  - Hangi gün/saat filtresine takıldığı gibi durumlar detaylı loglanır.
- 💾 **Kalıcı Ayarlar:**
  - Token, filtreler ve tercihleriniz Windows AppData dizininde saklanır; uygulamayı her açtığınızda kaldığınız yerden hazır gelir.
- ⚡ **Hafif ve Doğrudan Bağlantı:**
  - Proxy/VPN gerektirmez, doğrudan ev internetiniz üzerinden bağlandığı için Sağlık Bakanlığı WAF/güvenlik duvarına takılmaz.

---

## 🛠️ Kurulum ve Çalıştırma

### Gereksinimler
- Bilgisayarınızda [Node.js](https://nodejs.org/) (v18 veya üzeri) kurulu olmalıdır.

### Adım Adım Çalıştırma
1. **Projeyi klonlayın veya indirin:**
   ```powershell
   git clone https://github.com/malierel/mhrs-otorandevu.git
   cd mhrs-otorandevu
   ```

2. **Gerekli kütüphaneleri yükleyin:**
   ```powershell
   npm install
   ```

3. **Uygulamayı başlatın:**
   ```powershell
   npm start
   ```

---

## 🔑 MHRS Token Alma Rehberi

1. Tarayıcınızda [mhrs.gov.tr](https://mhrs.gov.tr/) adresine girip e-Devlet ile oturum açın.
2. Klavyeden `F12` tuşuna basarak **Geliştirici Araçları**'nı açın ve **Network (Ağ)** sekmesine gelin.
3. Sayfada herhangi bir işlem yapın veya sayfayı yenileyin.
4. Ağ listesinde listelenen `prd.mhrs.gov.tr` isteklerinden birine tıklayın.
5. **Headers (Başlıklar)** altında yer alan **Authorization** başlığındaki `Bearer eyJ...` ile başlayan token değerini kopyalayın.
6. Uygulamanın en üstündeki **MHRS Bearer Token** kutusuna yapıştırıp **"Doğrula"** butonuna basın.

---

## 📦 Paketleme (Taşınabilir Sürüm Oluşturma)

Uygulamayı kurulum gerektirmeyen bağımsız bir Windows uygulaması olarak derlemek isterseniz:

```powershell
# Klasör olarak derlemek için (dist/win-unpacked):
npm run pack

# Tek parça Portable .exe üretmek için:
npm run dist
```

---

## ⚖️ Yasal Uyarı

Bu yazılım yalnızca eğitim ve kişisel kullanım amacıyla geliştirilmiştir. Randevu alma süreçlerinde Sağlık Bakanlığı'nın kullanım koşullarına ve kurallarına riayet etmek kullanıcının sorumluluğundadır.
