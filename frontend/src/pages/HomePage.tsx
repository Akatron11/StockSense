import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { StockManagerDashboard } from "./StockManagerDashboard";
import { BranchManagerDashboard } from "./BranchManagerDashboard";
import { GeneralManagerDashboard } from "./GeneralManagerDashboard";
import { SellerManagerDashboard } from "./SellerManagerDashboard";
import { OperationsChiefDashboard } from "./OperationsChiefDashboard";
import { VendorCustomersPage } from "./VendorCustomersPage";
import { AccountOverridePage } from "./AccountOverridePage";

// Rol-bazlı pano gövdeleri role role kuruluyor (Sprint 4). Kurulmuş roller için ilgili panoya yönlendirir,
// geri kalanlar için geçici "Hoş geldin" içeriği gösterir.
export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const activeLabel = user ? t(homeLabelForRole(user.role)) : "";

  switch (user?.role) {
    case "stock_manager":
      return <StockManagerDashboard />;
    case "branch_manager":
      return <BranchManagerDashboard />;
    case "general_manager":
    case "region_manager":
      return <GeneralManagerDashboard />;
    case "seller_manager":
      return <SellerManagerDashboard />;
    case "operations_chief":
      return <OperationsChiefDashboard />;
    case "vendor_manager":
      return <VendorCustomersPage />;
    case "company_it":
      return <AccountOverridePage />;
  }

  return (
    <AppShell pageTitle={activeLabel}>
      <div className="panel">
        <div className="panel-head">{t("home.welcome")}</div>
        <div className="panel-body">
          <p>{t("home.loggedInAs", { name: user?.full_name, role: user?.role })}</p>
          <p className="muted-small">{t("home.placeholderNote")}</p>
        </div>
      </div>
    </AppShell>
  );
}
