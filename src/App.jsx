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
import AgentUsage from "./pages/AgentUsage";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { registerTokenGetter } from "./api/apiClient";
import { addUserToBackend } from "./api/users";

function Placeholder({ name }) {
  return <div className="text-gray-500">{name} — coming soon</div>;
}

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
  // null = not checked yet, true/false once we know
  const [staffOk, setStaffOk] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      registerTokenGetter(getToken);
    }
  }, [isAuthenticated, getToken]);

  // Sync staff user on login. The backend now REJECTS (403) any email that
  // isn't already a pre-provisioned StaffUser — it never creates one on the
  // fly. So this call is the actual access gate, not just a data sync.
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
          // Unexpected error (network, 500) — don't silently lock the
          // person out; let them through and surface the failure elsewhere.
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
          <Route
            path="/campaigns"
            element={<Placeholder name="Segments / Campaigns" />}
          />
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
