// src/components/ui/Badge.jsx
const VARIANTS = {
  neutral: "bg-gray-100 text-gray-600",
  positive: "bg-fairway-100 text-fairway-700",
  warning: "bg-gold-300/40 text-gold-600",
  danger: "bg-red-50 text-red-600",
  info: "bg-blue-50 text-blue-600",
};

export default function Badge({
  children,
  variant = "neutral",
  className = "",
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${VARIANTS[variant] || VARIANTS.neutral} ${className}`}
    >
      {children}
    </span>
  );
}
