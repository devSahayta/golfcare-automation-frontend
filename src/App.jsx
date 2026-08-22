import { BrowserRouter, Routes, Route } from "react-router-dom";

function Placeholder({ name }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-gray-500">
      {name} — coming soon
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="/inbox" element={<Placeholder name="Inbox" />} />
        <Route
          path="/products"
          element={<Placeholder name="Products / Availability" />}
        />
        <Route path="/customers" element={<Placeholder name="Customers" />} />
        <Route path="/suppliers" element={<Placeholder name="Suppliers" />} />
        <Route
          path="/campaigns"
          element={<Placeholder name="Segments / Campaigns" />}
        />
        <Route path="/insights" element={<Placeholder name="Insights" />} />
        <Route path="/settings" element={<Placeholder name="Settings" />} />
      </Routes>
    </BrowserRouter>
  );
}
