// src/components/Topbar.jsx
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { LogoutLink } from "@kinde-oss/kinde-auth-react/components";
import { MenuIcon, GolfFlagMark } from "./icons";

export default function Topbar({ onOpenMobileMenu }) {
  const { user } = useKindeAuth();
  const initial = (user?.givenName || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-50 lg:hidden"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <div className="flex items-center gap-1.5 text-fairway-800 lg:hidden">
          <GolfFlagMark className="h-5 w-5" />
          <span className="text-sm font-semibold">Golf Care OS</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fairway-100 text-xs font-medium text-fairway-700">
            {initial}
          </span>
          <span className="text-sm text-gray-600">{user?.email}</span>
        </div>
        <LogoutLink className="cursor-pointer text-sm text-gray-500 hover:text-gray-900">
          Log out
        </LogoutLink>
      </div>
    </header>
  );
}
