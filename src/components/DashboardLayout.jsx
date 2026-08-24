import { Outlet } from "react-router-dom";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { LogoutLink } from "@kinde-oss/kinde-auth-react/components";

export default function DashboardLayout() {
  const { user } = useKindeAuth();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <span className="font-semibold text-gray-900">Golf Care OS</span>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{user?.email}</span>
          <LogoutLink className="text-gray-500 hover:text-gray-900 cursor-pointer">
            Log out
          </LogoutLink>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <Outlet />
      </main>
    </div>
  );
}
