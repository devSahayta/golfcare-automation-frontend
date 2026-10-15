//src/App.jsx

import { useEffect, useState } from "react";
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
// import Campaigns from "./pages/Campaigns";
import AgentUsage from "./pages/AgentUsage";
import Campaigns from "./pages/Campaigns";
import BroadcastCampaigns from "./pages/BroadcastCampaigns";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { registerTokenGetter } from "./api/apiClient";
import { addUserToBackend } from "./api/users";

function NoAccountScreen() {
  const { logout } = useKindeAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="text-lg font-semibold text-gray-900">No account found</p>
      <p className="max-w-sm text-sm text-gray-500">
        This email isn't set up as Golf Care staff yet. Ask an admin to add you,
        then try signing in again.
      </p>
      <button
        onClick={() => logout()}
        className="mt-2 rounded-lg bg-fairway-900 px-4 py-2 text-sm font-medium text-white hover:bg-fairway-800"
      >
        Back to login
      </button>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, user, getToken } = useKindeAuth();
  const [staffOk, setStaffOk] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      registerTokenGetter(getToken);
    }
  }, [isAuthenticated, getToken]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let cancelled = false;
    addUserToBackend(user)
      .then(() => {
        if (!cancelled) setStaffOk(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 403) {
          setStaffOk(false);
        } else {
          console.error("Staff sync failed:", err);
          setStaffOk(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  if (isAuthenticated && staffOk === false) {
    return <NoAccountScreen />;
  }

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
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/broadcast-campaigns" element={<BroadcastCampaigns />} />
          {/* <Route path="/insights" element={<Placeholder name="Insights" />} /> */}
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/agent-usage" element={<AgentUsage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
