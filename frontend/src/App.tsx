import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { CashierPos } from "./pages/CashierPos";
import { ProductCatalogPage } from "./pages/ProductCatalogPage";
import { PriceManagementPage } from "./pages/PriceManagementPage";
import { StockRequestPage } from "./pages/StockRequestPage";
import { EmployeeManagementPage } from "./pages/EmployeeManagementPage";
import { StaffRegistrationPage } from "./pages/StaffRegistrationPage";
import { ShiftCalendarPage } from "./pages/ShiftCalendarPage";
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
            path="/stock-request"
            element={
              <ProtectedRoute>
                <StockRequestPage />
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
