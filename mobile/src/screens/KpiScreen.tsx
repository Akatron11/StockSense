import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSalesReport } from "../hooks/useSalesReport";

export function KpiScreen() {
  const { report, loading, error, reload } = useSalesReport(30);

  if (loading && !report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (report && report.profit_margin_pct === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Bu rol için kâr marjı verisine erişim yok</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Net kâr marjı</Text>
        <Text style={styles.cardValue}>%{report?.profit_margin_pct?.toFixed(1)}</Text>
        {report && report.cost_data_coverage_pct < 100 && (
          <Text style={styles.muted}>Maliyet verisi kapsamı: %{report.cost_data_coverage_pct.toFixed(0)}</Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Kâr tutarı</Text>
        <Text style={styles.cardValue}>{report?.profit_margin_amount?.toFixed(2)} ₺</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Düşük stoklu ürün sayısı</Text>
        <Text style={styles.cardValue}>{report?.low_stock_count}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  muted: { color: "#888" },
  container: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 8, backgroundColor: "#eef4ff" },
  cardLabel: { color: "#555" },
  cardValue: { fontSize: 22, fontWeight: "bold", marginTop: 4 },
});
