// src/pages/Settings.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchUsers } from "../api/users";
import { fetchTemplates } from "../api/templates";
import useDocumentTitle from "../hooks/useDocumentTitle";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Pagination from "../components/ui/Pagination";
import Badge from "../components/ui/Badge";

const TABS = [
  { key: "staff", label: "Staff" },
  { key: "templates", label: "Templates" },
];

const STAFF_LIMIT = 20;
const TEMPLATES_PAGE_SIZE = 20;

const ROLE_VARIANT = {
  OWNER: "warning",
  STAFF: "info",
  VIEWER: "neutral",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STAFF_COLUMNS = [
  {
    key: "name",
    header: "Name",
    render: (row) => (
      <span className="font-medium text-gray-900">{row.name}</span>
    ),
  },
  { key: "email", header: "Email" },
  {
    key: "role",
    header: "Role",
    render: (row) => (
      <Badge variant={ROLE_VARIANT[row.role] || "neutral"}>{row.role}</Badge>
    ),
  },
  {
    key: "isActive",
    header: "Status",
    render: (row) =>
      row.isActive ? (
        <Badge variant="positive">Active</Badge>
      ) : (
        <Badge>Inactive</Badge>
      ),
  },
  {
    key: "createdAt",
    header: "Added",
    render: (row) => formatDate(row.createdAt),
  },
];

// Samvaadik's template payload shape isn't pinned down yet in our docs, so
// this reads defensively — falling back across the field names a
// Meta-template API is likely to use rather than assuming one exact shape.
const TEMPLATE_COLUMNS = [
  {
    key: "name",
    header: "Template",
    render: (row) => (
      <span className="font-medium text-gray-900">
        {row.name || row.template_name || "—"}
      </span>
    ),
  },
  { key: "category", header: "Category", render: (row) => row.category || "—" },
  { key: "language", header: "Language", render: (row) => row.language || "—" },
  {
    key: "status",
    header: "Status",
    render: (row) => {
      const status = row.status || row.meta_status || "UNKNOWN";
      const variant = /approved/i.test(status)
        ? "positive"
        : /reject/i.test(status)
          ? "danger"
          : "neutral";
      return <Badge variant={variant}>{status}</Badge>;
    },
  },
];

export default function Settings() {
  useDocumentTitle("Settings");
  const [tab, setTab] = useState("staff");

  // Staff — server-side pagination, same pattern as Customers/Products/Suppliers
  const [staff, setStaff] = useState([]);
  const [staffTotal, setStaffTotal] = useState(0);
  const [staffOffset, setStaffOffset] = useState(0);
  const [staffLoading, setStaffLoading] = useState(true);

  // Templates — Samvaadik's endpoint has no documented pagination or search
  // params, so we fetch the full list once and filter/page it client-side.
  const [allTemplates, setAllTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatesOffset, setTemplatesOffset] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState(null);

  useEffect(() => {
    fetchUsers({ limit: STAFF_LIMIT, offset: staffOffset })
      .then((res) => {
        setStaff(res.data.staffUsers);
        setStaffTotal(res.data.total);
      })
      .finally(() => setStaffLoading(false));
  }, [staffOffset]);

  function handleStaffPageChange(newOffset) {
    setStaffLoading(true);
    setStaffOffset(newOffset);
  }

  useEffect(() => {
    fetchTemplates()
      .then((res) => setAllTemplates(res.data.templates || []))
      .catch(() =>
        setTemplatesError(
          "Couldn't reach Samvaadik. Check the API key and try again.",
        ),
      )
      .finally(() => setTemplatesLoading(false));
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return allTemplates;
    const q = templateSearch.trim().toLowerCase();
    return allTemplates.filter((t) => {
      const name = (t.name || t.template_name || "").toLowerCase();
      const category = (t.category || "").toLowerCase();
      return name.includes(q) || category.includes(q);
    });
  }, [allTemplates, templateSearch]);

  const visibleTemplates = filteredTemplates.slice(
    templatesOffset,
    templatesOffset + TEMPLATES_PAGE_SIZE,
  );

  function handleTemplateSearchChange(value) {
    setTemplatesOffset(0);
    setTemplateSearch(value);
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Staff access and WhatsApp message templates."
      />

      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-fairway-600 text-fairway-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "staff" && (
        <>
          <DataTable
            columns={STAFF_COLUMNS}
            rows={staff}
            loading={staffLoading}
            keyField="id"
            emptyTitle="No staff yet"
            emptyDescription="Staff are added automatically the first time they log in."
          />
          <div className="mt-4">
            <Pagination
              total={staffTotal}
              limit={STAFF_LIMIT}
              offset={staffOffset}
              onPageChange={handleStaffPageChange}
            />
          </div>
        </>
      )}

      {tab === "templates" && (
        <>
          {templatesError ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-6 py-14 text-center">
              <p className="text-sm font-medium text-gray-700">
                Couldn't load templates
              </p>
              <p className="mt-1 text-sm text-gray-400">{templatesError}</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search templates by name or category…"
                  onChange={(e) => handleTemplateSearchChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-fairway-400 focus:outline-none focus:ring-1 focus:ring-fairway-400 sm:w-72"
                />
              </div>
              <DataTable
                columns={TEMPLATE_COLUMNS}
                rows={visibleTemplates}
                loading={templatesLoading}
                keyField="name"
                emptyTitle="No templates found"
                emptyDescription={
                  templateSearch
                    ? "Try a different name or category."
                    : "Meta-approved templates created in Samvaadik will show up here."
                }
              />
              <div className="mt-4">
                <Pagination
                  total={filteredTemplates.length}
                  limit={TEMPLATES_PAGE_SIZE}
                  offset={templatesOffset}
                  onPageChange={setTemplatesOffset}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
