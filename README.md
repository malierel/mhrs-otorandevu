# MHRS Otomatik Randevu Asistanı (Masaüstü Uygulaması)

T.C. Sağlık Bakanlığı MHRS (Merkezi Hekim Randevu Sistemi) için modern, hafif ve arka planda çalışan Windows masaüstü randevu yakalama asistanı.

## 🚀 Özellikler

- **Resmi MHRS Tasarımı:** Sade ve kullanımı kolay arayüz.
- **Akıllı Filtreleme:** İl, ilçe, poliklinik, hekim cinsiyeti, tarih aralığı, tercih edilen günler (Pzt-Paz) ve saat dilimi (örn: 09:00 - 12:30).
- **Tüm Gün Seçeneği:** Saat kısıtı olmadan günün ilk boş slotunu yakalama modu.
- **Sistem Tepsisi (System Tray):** Simge durumuna küçültüldüğünde veya kapatıldığında sağ alttaki gizli simgeler arasına geçer, sistemi yormadan arka planda çalışmaya devam eder.
- **Windows Bildirimleri:** Randevu başarıyla alındığında Windows sesli masaüstü bildirimi (Toast) gönderir.
- **Canlı Konsol (Terminal):** Anlık yapılan tüm kontrolleri, slot detaylarını ve hataları gösterir; metinler seçilebilir ve kopyalanabilir.
- **Kalıcı Ayarlar:** Token ve arama tercihlerinizi otomatik olarak hatırlar.

## 💻 Kurulum ve Çalıştırma

### Gereksinimler
- [Node.js](https://nodejs.org/) (v18 veya üzeri)

### Çalıştırma
```powershell
# Bağımlılıkları yükleyin
npm install

# Uygulamayı başlatın
npm start
```

## 📦 Paketleme (Taşınabilir Sürüm)
```powershell
# Klasör olarak derlemek için:
npm run pack

# Tek parça Portable .exe üretmek için:
npm run dist
```
