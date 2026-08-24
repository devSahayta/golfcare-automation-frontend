import { LoginLink } from "@kinde-oss/kinde-auth-react/components";

function GolfFlagMark({ className = "h-7 w-7" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
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

const FEATURES = [
  {
    title: "AI Sales Concierge",
    description: "Turns WhatsApp chats into premium recommendations.",
  },
  {
    title: "Supplier Network",
    description: "Automated stock check-ins — no more phone tag.",
  },
  {
    title: "Lifecycle Campaigns",
    description: "Birthday, replenishment and winback, on autopilot.",
  },
  {
    title: "Insights, on demand",
    description: "Ask your data a question, get a straight answer.",
  },
];

export default function Login() {
  return (
    <div className="grid min-h-screen bg-white md:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-fairway-900 to-fairway-700 p-12 text-white md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative flex items-center gap-2 text-gold-400">
          <GolfFlagMark />
          <span className="text-lg font-semibold tracking-tight text-white">
            Golf Care OS
          </span>
        </div>

        <div className="relative max-w-sm">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Twenty years of golf retail, systematised.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-fairway-100">
            One dashboard for the agents running your sales, supplier check-ins,
            and lifecycle campaigns — so every customer gets the advisory
            experience, automatically.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {feature.title}
                  </p>
                  <p className="text-sm text-fairway-200">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-fairway-300">
          Golf Care · Est. 2006
        </p>
      </div>

      {/* Sign-in card */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-fairway-900 md:hidden">
            <GolfFlagMark />
            <span className="text-lg font-semibold tracking-tight">
              Golf Care OS
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Sign in to the staff dashboard to manage sales, suppliers, and
            campaigns.
          </p>

          <LoginLink className="mt-8 flex w-full items-center justify-center rounded-lg bg-fairway-900 px-4 py-2.5 text-sm font-medium text-white cursor-pointer shadow-sm transition-colors hover:bg-fairway-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-fairway-700 focus-visible:ring-offset-2">
            Log in
          </LoginLink>

          <p className="mt-6 text-center text-xs text-gray-400">
            Access is limited to authorized Golf Care staff.
          </p>
        </div>
      </div>
    </div>
  );
}
