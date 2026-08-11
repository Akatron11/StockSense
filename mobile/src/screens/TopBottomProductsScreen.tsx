import { ActivityIndicator, Button, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSalesReport } from "../hooks/useSalesReport";

export function TopBottomProductsScreen() {
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
        <Button title="Tekrar dene" onPress={reload} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <Text style={styles.sectionTitle}>En az satan</Text>
      {report?.least_selling.length ? (
        report.least_selling.map((p) => (
          <View key={p.product_id} style={styles.listRow}>
            <Text>{p.product_name}</Text>
            <Text style={styles.muted}>{p.quantity} adet</Text>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>Veri yok</Text>
      )}

      <Text style={styles.sectionTitle}>Hiç satılmayan</Text>
      {report?.never_sold.length ? (
        report.never_sold.map((p) => (
          <View key={p.product_id} style={styles.listRow}>
            <Text>{p.product_name}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>Hiç satılmayan ürün yok</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  container: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  listRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  muted: { color: "#888" },
});
