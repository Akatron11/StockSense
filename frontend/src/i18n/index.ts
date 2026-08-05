import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import tr from "./locales/tr.json";
import en from "./locales/en.json";

const LANG_STORAGE_KEY = "stocksense_lang";

// Madde 17 (Lokalizasyon) — dil Login ekranında seçilir, kullanıcı menüsünden değiştirilebilir,
// localStorage'da kalıcı. Tüm sayfa içerikleri (dashboard/form metinleri, rol etiketleri dahil)
// 2026-08-05 itibarıyla çevrildi (hoca geri bildirimi, PROCESS.md).
i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: localStorage.getItem(LANG_STORAGE_KEY) ?? "tr",
  fallbackLng: "tr",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANG_STORAGE_KEY, lng);
});

export default i18n;
