import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";
import { setAuthToken } from "./api/apiClient";
import { addUserToBackend } from "./api/users";

function Placeholder({ name }) {
  return <div className="text-gray-500">{name} — coming soon</div>;
}

export default function App() {
  const { isAuthenticated, user, getToken } = useKindeAuth();

  // Sync user on first login and set auth token
  useEffect(() => {
    if (isAuthenticated && user) {
      addUserToBackend(user);
      getToken()
        .then((token) => {
          setAuthToken(token);
        })
        .catch((err) => {
          console.error("getToken failed:", err);
        });
    }
  }, [isAuthenticated, user, getToken]);

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
          <Route path="/" element={<Placeholder name="Dashboard" />} />
          <Route path="/inbox" element={<Placeholder name="Inbox" />} />
          <Route
            path="/products"
            element={<Placeholder name="Products / Availability" />}
          />
          <Route path="/customers" element={<Placeholder name="Customers" />} />
          <Route path="/suppliers" element={<Placeholder name="Suppliers" />} />
          <Route
            path="/campaigns"
            element={<Placeholder name="Segments / Campaigns" />}
          />
          <Route path="/insights" element={<Placeholder name="Insights" />} />
          <Route path="/settings" element={<Placeholder name="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
