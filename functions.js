const axios = require("axios");
const dns = require("dns").promises;
const tls = require("tls");

const turkceKarakterler = "ğüşöçıİĞÜŞÖÇ";
const ingilizceKarakterler = "gusociIGUSOC";
const karakterMap = new Map();
for (let i = 0; i < turkceKarakterler.length; i++) {
  karakterMap.set(turkceKarakterler[i], ingilizceKarakterler[i]);
}

// Güvenlik duvarlarını (WAF) aşmak için gerçek tarayıcı başlıkları içeren Axios istemcisi
const client = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    Origin: "https://mhrs.gov.tr",
    Referer: "https://mhrs.gov.tr/",
    "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
  },
  timeout: 20000,
});

module.exports = {
  diagnoseMhrsConnection: async () => {
    const host = "prd.mhrs.gov.tr";
    const port = 443;
    const results = {
      host,
      dns: null,
      tls: null,
    };

    try {
      const lookup = await dns.lookup(host);
      results.dns = { success: true, ip: lookup.address, family: lookup.family };
    } catch (e) {
      results.dns = { success: false, error: e.message };
      return results;
    }

    return new Promise((resolve) => {
      const socket = tls.connect(
        {
          host,
          port,
          servername: host,
          timeout: 7000,
        },
        () => {
          results.tls = {
            success: true,
            authorized: socket.authorized,
            protocol: socket.getProtocol(),
            cipher: socket.getCipher()?.name,
          };
          socket.end();
          resolve(results);
        }
      );

      socket.on("error", (err) => {
        results.tls = { success: false, error: err.message, code: err.code };
        resolve(results);
      });

      socket.on("timeout", () => {
        results.tls = { success: false, error: "Bağlantı zaman aşımına uğradı (Timeout)" };
        socket.destroy();
        resolve(results);
      });
    });
  },

  yaziSadele: (cumle) => {
    let yeniStr = "";
    for (let i = 0; i < cumle.length; i++) {
      const karakter = cumle[i];
      yeniStr += karakterMap.has(karakter) ? karakterMap.get(karakter) : karakter;
    }
    return yeniStr.toLowerCase().replaceAll(" ", "");
  },

  girisYap: (tckimlik, sifre) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        kullaniciAdi: tckimlik,
        parola: sifre,
        islemKanali: "VATANDAS_WEB",
        girisTipi: "PAROLA",
      });

      const config = {
        headers: {
          "Content-Type": "application/json",
        },
      };

      client
        .post("https://prd.mhrs.gov.tr/api/vatandas/login", data, config)
        .then((resp) => resolve(resp.data))
        .catch((error) => reject(error));
    });
  },

  enabizTokenIleGiris: (enabizToken) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        enabizToken: enabizToken,
        islemKanali: "VATANDAS_ENABIZ",
      });
      const config = {
        headers: {
          "Content-Type": "application/json",
        },
      };
      client
        .post("https://prd.mhrs.gov.tr/api/vatandas/enabiz/login", data, config)
        .then((resp) => resolve(resp.data))
        .catch((error) => reject(error));
    });
  },

  kullaniciRandevulari: (token) => {
    return new Promise((resolve, reject) => {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      };

      client
        .get("https://prd.mhrs.gov.tr/api/kurum/randevu/randevu-gecmisi", config)
        .then((resp) => resolve(resp.data.data))
        .catch((error) => reject(error));
    });
  },

  illeriAl: async (token) => {
    return new Promise((resolve, reject) => {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      };

      client
        .get("https://prd.mhrs.gov.tr/api/yonetim/genel/il/selectinput-tree", config)
        .then((resp) => resolve(resp.data))
        .catch((error) => reject(error));
    });
  },

  ilinIlceleri: async (token, ilPlaka) => {
    return new Promise((resolve, reject) => {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      };

      client
        .get(`https://prd.mhrs.gov.tr/api/yonetim/genel/ilce/selectinput/${ilPlaka}`, config)
        .then((resp) => resolve(resp.data))
        .catch((error) => reject(error));
    });
  },

  klinikleriAl: async (token, ilPlaka, ilceId) => {
    return new Promise((resolve, reject) => {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      };

      client
        .get(
          `https://prd.mhrs.gov.tr/api/kurum/kurum/kurum-klinik/il/${ilPlaka}/ilce/${ilceId}/kurum/-1/aksiyon/200/select-input`,
          config
        )
        .then((resp) => resolve(resp.data.data))
        .catch((error) => reject(error));
    });
  },

  randevuAra: (token, plaka, ilceId, cinsiyet, klinikid, baslangic, bitis) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        aksiyonId: "200",
        cinsiyet: cinsiyet,
        mhrsHekimId: -1,
        mhrsIlId: plaka,
        mhrsIlceId: ilceId,
        mhrsKlinikId: klinikid,
        mhrsKurumId: -1,
        muayeneYeriId: -1,
        tumRandevular: false,
        ekRandevu: true,
        randevuZamaniList: [],
        baslangicZamani: baslangic,
        bitisZamani: bitis,
      });

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      };

      client
        .post("https://prd.mhrs.gov.tr/api/kurum-rss/randevu/slot-sorgulama/arama", data, config)
        .then((resp) => resolve(resp.data.data))
        .catch((error) => reject(error));
    });
  },

  hekimAra: (token, plaka, cinsiyet, klinikid, kurumid, hekimid) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        aksiyonId: 200,
        mhrsHekimId: hekimid,
        mhrsIlId: plaka,
        mhrsKlinikId: klinikid,
        mhrsKurumId: kurumid,
        muayeneYeriId: -1,
        cinsiyet: cinsiyet,
        tumRandevular: false,
        ekRandevu: true,
        randevuZamaniList: [],
      });

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      };

      client
        .post("https://prd.mhrs.gov.tr/api/kurum-rss/randevu/slot-sorgulama/slot", data, config)
        .then((resp) => resolve(resp.data.data))
        .catch((error) => reject(error));
    });
  },

  randevuAl: (token, fkslotid, fkcetvelid, baslangiczamani, bitiszamani) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        fkSlotId: fkslotid,
        fkCetvelId: fkcetvelid,
        yenidogan: false,
        baslangicZamani: baslangiczamani,
        bitisZamani: bitiszamani,
        randevuNotu: "",
      });

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      };

      client
        .post("https://prd.mhrs.gov.tr/api/kurum/randevu/randevu-ekle", data, config)
        .then((resp) => resolve(resp.data.data))
        .catch((error) => reject(error));
    });
  },
};
