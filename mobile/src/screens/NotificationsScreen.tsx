import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../api/client";
import { getNotifications, markNotificationRead } from "../api/notifications";
import type { ExpiringItem, LowStockItem, NotificationsOut } from "../types/notification";

type Row =
  | { kind: "low_stock"; item: LowStockItem }
  | { kind: "expiring"; item: ExpiringItem };

export function NotificationsScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<NotificationsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const result = await getNotifications(token);
      setData(result);
    } catch (err) {
      setError(apiErrorMessage(err, "Bildirimler yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkRead(row: Row) {
    if (!token) return;
    // Optimistic: satırı hemen okundu işaretle, hata olursa yeniden yükle.
    setData((prev) => {
      if (!prev) return prev;
      if (row.kind === "low_stock") {
        return {
          ...prev,
          low_stock: prev.low_stock.map((i) =>
            i.product_id === row.item.product_id && i.branch_id === row.item.branch_id ? { ...i, is_read: true } : i
          ),
        };
      }
      return {
        ...prev,
        expiring: prev.expiring.map((i) =>
          i.product_id === row.item.product_id && i.branch_id === row.item.branch_id ? { ...i, is_read: true } : i
        ),
      };
    });
    try {
      await markNotificationRead(token, {
        kind: row.kind,
        product_id: row.item.product_id,
        branch_id: row.item.branch_id,
      });
    } catch {
      load();
    }
  }

  if (loading) {
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

  const rows: Row[] = [
    ...(data?.low_stock.map((item) => ({ kind: "low_stock" as const, item })) ?? []),
    ...(data?.expiring.map((item) => ({ kind: "expiring" as const, item })) ?? []),
  ];

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => `${row.kind}-${row.item.product_id}-${row.item.branch_id}`}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      ListEmptyComponent={<Text style={styles.empty}>Bekleyen bildirim yok</Text>}
      renderItem={({ item: row }) => (
        <Pressable
          style={[styles.row, row.item.is_read && styles.rowRead]}
          onPress={() => !row.item.is_read && handleMarkRead(row)}
        >
          <Text style={styles.rowTitle}>{row.item.product_name}</Text>
          <Text style={styles.rowDetail}>
            {row.kind === "low_stock"
              ? `Düşük stok: ${(row.item as LowStockItem).quantity} / eşik ${(row.item as LowStockItem).threshold}`
              : `SKT: ${(row.item as ExpiringItem).best_before_date}`}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  list: { padding: 16, gap: 8 },
  empty: { textAlign: "center", color: "#888", marginTop: 32 },
  row: { padding: 12, borderRadius: 8, backgroundColor: "#fff3e0" },
  rowRead: { backgroundColor: "#f0f0f0", opacity: 0.6 },
  rowTitle: { fontWeight: "600" },
  rowDetail: { color: "#555", marginTop: 4 },
});
