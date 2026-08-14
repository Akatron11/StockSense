import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { CashierPos } from "./pages/CashierPos";
import { ProductCatalogPage } from "./pages/ProductCatalogPage";
import { StockManagerDashboard } from "./pages/StockManagerDashboard";
import { PriceManagementPage } from "./pages/PriceManagementPage";
import { StockRequestPage } from "./pages/StockRequestPage";
import { StockAreaLayoutPage } from "./pages/StockAreaLayoutPage";
import { LayoutSuggestionPage } from "./pages/LayoutSuggestionPage";
import { ReportsDetailPage } from "./pages/ReportsDetailPage";
import { EmployeeManagementPage } from "./pages/EmployeeManagementPage";
import { AccountOverridePage } from "./pages/AccountOverridePage";
import { StaffRegistrationPage } from "./pages/StaffRegistrationPage";
import { ShiftCalendarPage } from "./pages/ShiftCalendarPage";
import { Day0SetupPage } from "./pages/Day0SetupPage";
import "./styles/app.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <CashierPos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog"
            element={
              <ProtectedRoute>
                <ProductCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/price"
            element={
              <ProtectedRoute>
                <PriceManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock"
            element={
              <ProtectedRoute>
                <StockManagerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock-request"
            element={
              <ProtectedRoute>
                <StockRequestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock-layout"
            element={
              <ProtectedRoute>
                <StockAreaLayoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/layout"
            element={
              <ProtectedRoute>
                <LayoutSuggestionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <EmployeeManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account-override"
            element={
              <ProtectedRoute>
                <AccountOverridePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/day0-setup"
            element={
              <ProtectedRoute>
                <Day0SetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <StaffRegistrationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shifts"
            element={
              <ProtectedRoute>
                <ShiftCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
