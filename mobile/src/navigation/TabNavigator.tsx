import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Button } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { canAccessReports } from "../auth/roleAccess";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SalesReportScreen } from "../screens/SalesReportScreen";
import { TopBottomProductsScreen } from "../screens/TopBottomProductsScreen";
import { KpiScreen } from "../screens/KpiScreen";

const Tab = createBottomTabNavigator();

// Sprint 6 review bulgusu (2026-08-13) — AuthContext.logout() tanımlıydı ama hiçbir ekrandan
// çağrılmıyordu, kullanıcı çıkış/tenant değiştirme yolu yoktu. Tüm tab'lardaki header'a ortak
// bir çıkış butonu eklendi (screenOptions ile, her ekrana ayrı ayrı eklemek yerine).
function LogoutButton() {
  const { logout } = useAuth();
  return <Button title="Çıkış" onPress={logout} />;
}

export function TabNavigator() {
  const { user } = useAuth();
  const showReports = user ? canAccessReports(user.role) : false;

  return (
    <Tab.Navigator screenOptions={{ headerRight: () => <LogoutButton /> }}>
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Bildirimler" }} />
      {showReports && (
        <>
          <Tab.Screen name="SalesReport" component={SalesReportScreen} options={{ title: "Satış raporu" }} />
          <Tab.Screen name="TopBottomProducts" component={TopBottomProductsScreen} options={{ title: "Ürünler" }} />
          <Tab.Screen name="Kpi" component={KpiScreen} options={{ title: "KPI" }} />
        </>
      )}
    </Tab.Navigator>
  );
}
