const axios = require("axios");
const http = require("http");
const https = require("https");

const turkceKarakterler = "ğüşöçıİĞÜŞÖÇ";
const ingilizceKarakterler = "gusociIGUSOC";
const karakterMap = new Map();
for (let i = 0; i < turkceKarakterler.length; i++) {
  karakterMap.set(turkceKarakterler[i], ingilizceKarakterler[i]);
}

// TCP/TLS el sıkışmalarını tekrar tekrar yapmamak ve 2-3 kat hızlandırmak için Keep-Alive Agent
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

// Güvenlik duvarlarını (WAF) aşmak için gerçek tarayıcı başlıkları içeren Axios istemcisi
const client = axios.create({
  httpAgent,
  httpsAgent,
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
  yaziSadele: (cumle) => {
    let yeniStr = "";
    for (let i = 0; i < cumle.length; i++) {
      const karakter = cumle[i];
      yeniStr += karakterMap.has(karakter) ? karakterMap.get(karakter) : karakter;
    }
    return yeniStr.toLowerCase().replaceAll(" ", "");
  },

  kullaniciRandevulari: async (token) => {
    const resp = await client.get("https://prd.mhrs.gov.tr/api/kurum/randevu/randevu-gecmisi", {
      headers: { Authorization: token },
    });
    return resp.data.data;
  },

  illeriAl: async (token) => {
    const resp = await client.get("https://prd.mhrs.gov.tr/api/yonetim/genel/il/selectinput-tree", {
      headers: { Authorization: token },
    });
    return resp.data;
  },

  ilinIlceleri: async (token, ilPlaka) => {
    const resp = await client.get(
      `https://prd.mhrs.gov.tr/api/yonetim/genel/ilce/selectinput/${ilPlaka}`,
      { headers: { Authorization: token } }
    );
    return resp.data;
  },

  klinikleriAl: async (token, ilPlaka, ilceId) => {
    const resp = await client.get(
      `https://prd.mhrs.gov.tr/api/kurum/kurum/kurum-klinik/il/${ilPlaka}/ilce/${ilceId}/kurum/-1/aksiyon/200/select-input`,
      { headers: { Authorization: token } }
    );
    return resp.data.data;
  },

  randevuAra: async (token, plaka, ilceId, cinsiyet, klinikid, baslangic, bitis) => {
    const resp = await client.post(
      "https://prd.mhrs.gov.tr/api/kurum-rss/randevu/slot-sorgulama/arama",
      {
        aksiyonId: "200",
        cinsiyet,
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
      },
      { headers: { Authorization: token } }
    );
    return resp.data.data;
  },

  hekimAra: async (token, plaka, cinsiyet, klinikid, kurumid, hekimid) => {
    const resp = await client.post(
      "https://prd.mhrs.gov.tr/api/kurum-rss/randevu/slot-sorgulama/slot",
      {
        aksiyonId: 200,
        mhrsHekimId: hekimid,
        mhrsIlId: plaka,
        mhrsKlinikId: klinikid,
        mhrsKurumId: kurumid,
        muayeneYeriId: -1,
        cinsiyet,
        tumRandevular: false,
        ekRandevu: true,
        randevuZamaniList: [],
      },
      { headers: { Authorization: token } }
    );
    return resp.data.data;
  },

  randevuAl: async (token, fkslotid, fkcetvelid, baslangiczamani, bitiszamani) => {
    const resp = await client.post(
      "https://prd.mhrs.gov.tr/api/kurum/randevu/randevu-ekle",
      {
        fkSlotId: fkslotid,
        fkCetvelId: fkcetvelid,
        yenidogan: false,
        baslangicZamani: baslangiczamani,
        bitisZamani: bitiszamani,
        randevuNotu: "",
      },
      { headers: { Authorization: token } }
    );
    return resp.data.data;
  },
};
