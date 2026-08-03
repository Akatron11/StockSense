import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import tr from "./locales/tr.json";
import en from "./locales/en.json";

const LANG_STORAGE_KEY = "stocksense_lang";

// Madde 17 (Lokalizasyon) — dil Login ekranında seçilir, kullanıcı menüsünden değiştirilebilir,
// localStorage'da kalıcı. Sadece "chrome" (nav/topbar/login) çevrildi (kullanıcı kararı, 2026-08-03) —
// sayfa içerikleri (dashboard/form metinleri) bu turun kapsamı dışı, ayrıca ele alınacak.
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
