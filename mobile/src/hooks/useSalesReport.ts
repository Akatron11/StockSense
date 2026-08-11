import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../api/client";
import { getSalesReport } from "../api/reports";
import type { SalesReportOut } from "../types/report";

export function useSalesReport(days: 7 | 30 | 90 = 30) {
  const { token } = useAuth();
  const [report, setReport] = useState<SalesReportOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSalesReport(token, days);
      setReport(result);
    } catch (err) {
      setError(apiErrorMessage(err, "Rapor yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    load();
  }, [load]);

  return { report, loading, error, reload: load };
}
