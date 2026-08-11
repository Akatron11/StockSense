import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth/AuthContext";
import { canAccessReports } from "../auth/roleAccess";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SalesReportScreen } from "../screens/SalesReportScreen";
import { TopBottomProductsScreen } from "../screens/TopBottomProductsScreen";
import { KpiScreen } from "../screens/KpiScreen";

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  const { user } = useAuth();
  const showReports = user ? canAccessReports(user.role) : false;

  return (
    <Tab.Navigator>
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
