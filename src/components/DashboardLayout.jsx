// src/components/DashboardLayout.jsx
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ErrorBoundary from "./ErrorBoundary";
import InsightsWidget from "./InsightsWidget";

export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  return (
    // h-screen + overflow-hidden pins this shell to the viewport; only
    // <main> below scrolls, so the sidebar and topbar stay put.
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileMenu={() => setMobileNavOpen(true)} />
        <main id="dashboard-main" className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* key={pathname} resets the boundary on navigation, so a crash on
              one page doesn't stay stuck once you click to a different one */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <InsightsWidget />
    </div>
  );
}
