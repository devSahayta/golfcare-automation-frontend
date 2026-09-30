// src/App.jsx

import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Activity from "./pages/Activity";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { registerTokenGetter } from "./api/apiClient";
import { addUserToBackend } from "./api/users";

function Placeholder({ name }) {
  return <div className="text-gray-500">{name} — coming soon</div>;
}

export default function App() {
  const { isAuthenticated, user, getToken } = useKindeAuth();

  // Register the token getter as soon as we know the user's authenticated —
  // every request now pulls a fresh token itself (see apiClient.js), so
  // nothing has to wait on this effect finishing before it's safe to fetch.
  useEffect(() => {
    if (isAuthenticated) {
      registerTokenGetter(getToken);
    }
  }, [isAuthenticated, getToken]);

  // Sync staff user on first login
  useEffect(() => {
    if (isAuthenticated && user) {
      addUserToBackend(user);
    }
  }, [isAuthenticated, user]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/products" element={<Products />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route
            path="/campaigns"
            element={<Placeholder name="Segments / Campaigns" />}
          />
          {/* <Route path="/insights" element={<Placeholder name="Insights" />} /> */}
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
