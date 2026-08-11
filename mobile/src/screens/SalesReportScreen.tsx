import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSalesReport } from "../hooks/useSalesReport";

export function SalesReportScreen() {
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <Text style={styles.scope}>{report?.scope_label}</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Toplam satış (son {report?.days} gün)</Text>
        <Text style={styles.cardValue}>{report?.total_sales.toFixed(2)} ₺</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>İşlem sayısı</Text>
        <Text style={styles.cardValue}>{report?.transaction_count}</Text>
      </View>
      <Text style={styles.sectionTitle}>En çok satan</Text>
      {report?.top_products.map((p) => (
        <View key={p.product_id} style={styles.listRow}>
          <Text>{p.product_name}</Text>
          <Text style={styles.muted}>{p.quantity} adet — {p.revenue.toFixed(2)} ₺</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  container: { padding: 16, gap: 12 },
  scope: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  card: { padding: 16, borderRadius: 8, backgroundColor: "#eef4ff" },
  cardLabel: { color: "#555" },
  cardValue: { fontSize: 22, fontWeight: "bold", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  listRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  muted: { color: "#888" },
});
