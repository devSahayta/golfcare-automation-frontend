// src/components/ActivityFeed.jsx
import { useEffect, useState } from "react";
import { fetchNotifications } from "../api/notifications";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import Pagination from "./ui/Pagination";
import { UsersIcon, TruckIcon } from "./icons";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ActivityFeed({ limit = 8, paginated = false }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNotifications({ limit, offset })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
        setError(null);
      })
      .catch(() => setError("Couldn't load recent activity."))
      .finally(() => setLoading(false));
  }, [limit, offset]);

  function handlePageChange(newOffset) {
    setLoading(true);
    setOffset(newOffset);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Couldn't load activity" description={error} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        description="Inbound WhatsApp conversations will show up here as they arrive."
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {items.map((item) => (
          <li key={item.messageId} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fairway-100 text-fairway-700">
              {item.contactType === "SUPPLIER" ? (
                <TruckIcon className="h-4 w-4" />
              ) : (
                <UsersIcon className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-gray-900">
                  {item.contactName || item.phone}
                </p>
                <span className="shrink-0 text-xs text-gray-400">
                  {timeAgo(item.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500">
                {item.preview || "(no text)"}
              </p>
            </div>
            <Badge
              variant={item.contactType === "SUPPLIER" ? "info" : "neutral"}
              className="mt-1 shrink-0"
            >
              {item.contactType === "SUPPLIER" ? "Supplier" : "Customer"}
            </Badge>
          </li>
        ))}
      </ul>
      {paginated && (
        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
