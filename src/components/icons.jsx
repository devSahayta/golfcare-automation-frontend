// src/components/icons.jsx
//
// Small stroke icons, same hand, same weight as Login.jsx's GolfFlagMark —
// deliberately not pulling in an icon library for eight glyphs.

function base(className) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    className,
    "aria-hidden": true,
  };
}

export function GolfFlagMark({ className = "h-6 w-6" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M6 3v18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M6 4.2 17.5 8 6 11.3V4.2Z" fill="currentColor" />
      <circle cx="6" cy="21" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function HomeIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M4 10.5 12 4l8 6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 9.5V19a1 1 0 0 0 1 1h3.5v-5a1.5 1.5 0 0 1 1.5-1.5v0A1.5 1.5 0 0 1 13.5 15v5H17a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BagIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M8 8V6a2 2 0 0 1 2-2h1.5a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.5 8h13l-1 12.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3L5.5 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 11.5v6M15 11.5v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UsersIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 19c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15.5 6.3a2.6 2.6 0 0 1 0 5.1M16.8 14.5c2.1.5 3.5 2.1 4 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TruckIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M3.5 7h9.5v9H3.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13 10h3.7L20 12.7V16h-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle
        cx="7.5"
        cy="17.5"
        r="1.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle
        cx="16.5"
        cy="17.5"
        r="1.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function MegaphoneIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M4 10.5v3a1 1 0 0 0 1 1h1.4l.9 4.2a1 1 0 0 0 1 .8h1a1 1 0 0 0 1-1.2L9.6 14.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6.4 10.5 15 6.2c1-.5 2 .3 2 1.4v7.8c0 1.1-1 1.9-2 1.4L6.4 13.5v-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 9.5c1 .4 1 3.6 0 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SparkIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M12 4.5c.5 3 2 4.5 5 5-3 .5-4.5 2-5 5-.5-3-2-4.5-5-5 3-.5 4.5-2 5-5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 16c.3 1.4.9 2 2.2 2.3-1.3.3-1.9.9-2.2 2.3-.3-1.4-.9-2-2.2-2.3 1.3-.3 1.9-.9 2.2-2.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.6 6.6l1.4 1.4M16 16l1.4 1.4M17.4 6.6 16 8M8 16l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MenuIcon({ className = "h-5 w-5" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ className = "h-5 w-5" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronRightIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M9 5.5 15.5 12 9 18.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExternalLinkIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 4h6v6M20 4 11 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatBubbleIcon({ className = "h-5 w-5" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BarChartIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M4 20V10M10 20V4M16 20v-7M4 20h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserCheckIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 19c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m15.5 12 1.8 1.8L21 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SendIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReceiptIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 20.5v-17Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5h6M9 12h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ClipboardListIcon({ className = "h-[18px] w-[18px]" }) {
  return (
    <svg {...base(className)}>
      <path
        d="M9 4.5h6a1 1 0 0 1 1 1V6H8v-.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 5.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1H16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 11h6M9 14.5h6M9 18h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
