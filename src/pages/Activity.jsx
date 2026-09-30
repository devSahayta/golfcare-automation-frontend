// src/pages/Activity.jsx
import PageHeader from "../components/ui/PageHeader";
import ActivityFeed from "../components/ActivityFeed";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { ExternalLinkIcon } from "../components/icons";

// Configurable via env in case this ever changes; falls back to the live
// URL so it works without needing a .env update.
const SAMVAADIK_CHAT_URL =
  import.meta.env.VITE_SAMVAADIK_CHAT_URL || "https://samvaadik.com/chat";

export default function Activity() {
  useDocumentTitle("Activity");
  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle="Recent inbound WhatsApp messages. Reply from Samvaadik's dashboard."
        actions={
          <a
            href={SAMVAADIK_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-fairway-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-fairway-800"
          >
            Open Samvaadik chat dashboard
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        }
      />
      <ActivityFeed limit={20} paginated />
    </div>
  );
}
