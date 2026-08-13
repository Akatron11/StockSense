import { useTranslation } from "react-i18next";
import type { ImportRowError } from "../types/product";

interface ImportErrorsModalProps {
  errors: ImportRowError[];
  onClose: () => void;
}

// PROCESS.md Faz 4 "Excel import modülü" (2026-08-13) — hepsi-ya-da-hiçbiri validasyon hatasında
// gösterilen satır/mesaj listesi. `row: null` olan hatalar dosya/format düzeyinde (örn. yanlış sütun
// başlığı) — satır numarası olmadan gösteriliyor.
export function ImportErrorsModal({ errors, onClose }: ImportErrorsModalProps) {
  const { t } = useTranslation();

  return (
    <div className="overlay open">
      <div className="modal">
        <div className="modal-head">{t("catalog.importErrorsTitle")}</div>
        <div className="modal-body">
          <div className="error-text">{t("catalog.importErrorsIntro", { count: errors.length })}</div>
          <div className="thead" style={{ gridTemplateColumns: "80px 1fr" }}>
            <span>{t("catalog.importErrorsRow")}</span>
            <span>{t("catalog.importErrorsMessage")}</span>
          </div>
          {errors.map((err, idx) => (
            <div className="trow" style={{ gridTemplateColumns: "80px 1fr" }} key={idx}>
              <span className="muted-small">{err.row ?? "—"}</span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
