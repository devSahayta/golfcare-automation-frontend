// src/components/Sidebar.jsx
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  GolfFlagMark,
  HomeIcon,
  BellIcon,
  BagIcon,
  UsersIcon,
  TruckIcon,
  MegaphoneIcon,
  ReceiptIcon,
  ClipboardListIcon,
  SparkIcon,
  SettingsIcon,
  CloseIcon,
} from "./icons";

// Chevron icon — inline so we don't need to import a new one
function ChevronDown({ className = "" }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 4l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small indent icon for sub-items
function SubDot() {
  return (
    <span className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
    </span>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: HomeIcon, end: true },
  { to: "/activity", label: "Activity", icon: BellIcon },
  { to: "/products", label: "Products", icon: BagIcon },
  { to: "/orders", label: "Orders", icon: ReceiptIcon },
  { to: "/customers", label: "Customers", icon: UsersIcon },
  { to: "/suppliers", label: "Suppliers", icon: TruckIcon },
  {
    label: "Campaigns",
    icon: MegaphoneIcon,
    children: [
      { to: "/campaigns", label: "Campaigns" },
      { to: "/broadcast-campaigns", label: "Broadcast" },
    ],
  },
  { to: "/audit-log", label: "Audit Log", icon: ClipboardListIcon },
  { to: "/agent-usage", label: "Agent Usage", icon: SparkIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavItem({ item, onNavigate }) {
  const location = useLocation();

  // Check if any child route is currently active
  const childIsActive =
    item.children?.some((c) => location.pathname === c.to) ?? false;

  // Expand by default if a child is active
  const [open, setOpen] = useState(childIsActive);

  // ── Group with children ───────────────────────────────────────────────────
  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
            childIsActive
              ? "bg-white/10 text-white"
              : "text-fairway-200 hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-3">
            {childIsActive && (
              <span className="absolute -left-3 h-5 w-0.5 rounded-full bg-gold-400" />
            )}
            <item.icon />
            {item.label}
          </span>
          <ChevronDown
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="mt-0.5 ml-4 space-y-0.5 border-l border-white/10 pl-3">
            {item.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-fairway-300 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <SubDot />
                    <span className={isActive ? "font-medium" : ""}>
                      {child.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Coming-soon item ──────────────────────────────────────────────────────
  if (item.comingSoon) {
    return (
      <div className="flex cursor-default items-center justify-between rounded-lg px-3 py-2 text-sm text-fairway-300/60">
        <span className="flex items-center gap-3">
          <item.icon />
          {item.label}
        </span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-fairway-200/70">
          Soon
        </span>
      </div>
    );
  }

  // ── Regular nav link ──────────────────────────────────────────────────────
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? "bg-white/10 text-white"
            : "text-fairway-200 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute -left-3 h-5 w-0.5 rounded-full bg-gold-400" />
          )}
          <item.icon />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const content = (
    <div className="relative flex h-full flex-col bg-fairway-900 px-4 py-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mb-6 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-gold-400">
          <GolfFlagMark />
          <span className="text-sm font-semibold tracking-tight text-white">
            Golf Care OS
          </span>
        </div>
        <button
          onClick={onCloseMobile}
          className="rounded-md p-1 text-fairway-200 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="relative flex-1 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to ?? item.label}
            item={item}
            onNavigate={onCloseMobile}
          />
        ))}
      </nav>

      <p className="relative px-3 text-xs text-fairway-300/60">
        Golf Care · Staff Dashboard
      </p>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 lg:block">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64">{content}</div>
        </div>
      )}
    </>
  );
}
