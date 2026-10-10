function validateSearchCriteria(criteria) {
  if (!criteria || typeof criteria !== "object") {
    return { valid: false, error: "Geçersiz arama kriteri nesnesi." };
  }

  if (!criteria.token || typeof criteria.token !== "string" || !criteria.token.startsWith("Bearer eyJ")) {
    return { valid: false, error: "Lütfen geçerli bir MHRS Bearer token giriniz." };
  }

  const plakaNum = Number(criteria.ilPlaka);
  if (isNaN(plakaNum) || plakaNum <= 0) {
    return { valid: false, error: "Geçerli bir il seçilmelidir." };
  }

  const klinikNum = Number(criteria.klinikId);
  if (isNaN(klinikNum) || klinikNum <= 0) {
    return { valid: false, error: "Geçerli bir poliklinik (klinik) seçilmelidir." };
  }

  if (criteria.cinsiyet && !["F", "K", "E"].includes(criteria.cinsiyet)) {
    return { valid: false, error: "Geçersiz hekim cinsiyeti seçimi." };
  }

  if (criteria.baslangicTarihi && criteria.bitisTarihi) {
    if (criteria.baslangicTarihi > criteria.bitisTarihi) {
      return { valid: false, error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." };
    }

    const tStart = new Date(criteria.baslangicTarihi).getTime();
    const tEnd = new Date(criteria.bitisTarihi).getTime();
    const diffDays = Math.round((tEnd - tStart) / (1000 * 60 * 60 * 24));
    if (diffDays > 15) {
      return { valid: false, error: "MHRS sistemi en fazla 15 günlük tarih aralığına izin vermektedir." };
    }
  }

  if (!criteria.tumGun && criteria.baslangicSaat && criteria.bitisSaat) {
    if (criteria.baslangicSaat >= criteria.bitisSaat) {
      return { valid: false, error: "Başlangıç saati bitiş saatinden önce olmalıdır." };
    }
  }

  return { valid: true };
}

module.exports = {
  validateSearchCriteria,
};
