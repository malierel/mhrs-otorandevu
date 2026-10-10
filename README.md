# 🩺 MHRS Otomatik Randevu Asistanı (Windows Masaüstü Uygulaması)

T.C. Sağlık Bakanlığı MHRS (Merkezi Hekim Randevu Sistemi) için geliştirilmiş modern, hafif, kullanıcı dostu ve arka planda sessizce çalışan Windows masaüstü randevu yakalama asistanı.

İstediğiniz il, ilçe, poliklinik, hekim cinsiyeti, kabul edilen günler ve saat aralığı kriterlerine göre MHRS'yi düzenli aralıklarla tarar; kriterlerinize uyan boş slot açıldığı anda randevunuzu otomatik olarak alır, Windows masaüstü bildirimi gönderir ve sesli uyarı verir.

---

## ✨ Öne Çıkan Özellikler

### 🎯 Gelişmiş Slot İzleme & Canlı Kart Görünümü
- **Doktor Bazında Birleşik Kartlar:** Bir doktora ait birden fazla gün ve saat tespit edildiğinde hepsi doktor ve hastane bazında tek bir kart çatısı altında toplanır.
- **Tarih & Saat Hapları (Pills):** Uygun saatler (🟢), saat aralığı dışı (⏳), izin verilmeyen gün (⚪) ve alınan randevu (✅) gibi durumlar renk kodlu saat etiketleriyle gösterilir.
- **Canlı Doktor Filtreleme (Combobox):** Slotlar sekmesindeki filtre kutusundan tek tıkla hekim listesi açılır veya klavyeden yazılarak anlık filtrelenir. Hızlı temizle (`✕`) butonuyla filtre tek hamlede sıfırlanabilir.
- **Anlık Sayaçlar:** Filtrelenen hekim sayısı ve tespit edilen toplam boş saat sayısı anlık olarak istatistik çubuğunda güncellenir.
- **Yüksek Performans:** Yüzlerce randevu slotu gelse dahi `DocumentFragment` ve render kısıtlaması (throttle) sayesinde arayüz donmaz ve akıcı çalışır.

### 📍 Akıllı ve Kademeli Arama Kriterleri
- **Arama Yapılabilir Combobox'lar:** İl, ilçe ve klinik alanlarında hem açılır listeden seçim yapılabilir hem de yazarak anında arama yapılabilir.
- **MHRS 15 Gün Kısıtlaması Koruması:** MHRS'nin en fazla 15 gün ileriye izin verme kuralı hem arayüzde (tarih seçicilerde dinamik min/max sınırları ve hızlı tarih çipleri) hem de arka plan doğrulama katmanında güvenceye alınmıştır.
- **İl ve İlçe Seçimi:** Alfabetik sıralı tüm iller ve seçilen ile ait dinamik ilçe listesi ("Fark Etmez / Tüm İlçeler" desteği).
- **Hekim Cinsiyeti:** Fark Etmez / Kadın / Erkek.
- **Kabul Edilen Günler:** Haftanın istenen günleri (Pazartesi - Pazar).
- **Saat Dilimi Filtresi:** İstenen saat aralığı (örn: `09:00 - 12:30`) veya saat sınırı olmadan ilk randevuyu yakalayan **"Tüm Gün"** modu.

### 🔕 Sistem Tepsisi (System Tray) & Bildirimler
- **Arka Planda Sessiz Çalışma:** Pencere simge durumuna küçültüldüğünde (`−`) veya kapatıldığında (`✕`) görev çubuğunu işgal etmez; doğrudan sağ alttaki **Gizli Simgeler (Tray)** alanına gizlenir.
- **Tepsi Menüsü:** Tepsideki MHRS logosuna çift tıklayarak pencereyi açabilir, sağ tık menüsünden taramayı yönetebilir veya uygulamadan çıkış yapabilirsiniz.
- **Windows Toast & Sesli Bildirim:** Randevu yakalandığında Windows masaüstü bildirimi açılır ve başarı melodisi çalar.

### 💻 Canlı Konsol (Terminal) & Filtreleme
- Taranan slotları, deneme sayılarını ve durumu milisaniyelik anlık akıtır.
- Log filtre sekmeleri: **Tümü**, **🎯 Slotlar** ve **❌ Hatalar**.
- Otomatik kaydırma açma/kapama (`⬇️ Oto-Kaydır`) ve logları panoya tek tıkla kopyalama (`📋 Kopyala`) araçları.

### 🔐 Güvenlik ve Kalıcı Ayarlar
- **DPAPI Token Şifreleme:** MHRS Bearer token'ınız Windows DPAPI (`safeStorage`) ile şifrelenerek saklanır, düz metin olarak diskte tutulmaz.
- **Canlı Token Süre Sayacı:** Token'ın son geçerlilik tarihi JWT çözümlemesiyle anlık olarak hesaplanır ve ekranda geri sayım olarak gösterilir.
- **Doğrudan Bağlantı:** Proxy/VPN gerektirmez, doğrudan ev internetiniz üzerinden güvenle çalışır.

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
