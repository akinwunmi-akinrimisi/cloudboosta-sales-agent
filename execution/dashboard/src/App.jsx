import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getToken } from "./api";
import Layout from "./Layout";
import Login from "./components/Login";
import Home from "./pages/Home";

function Placeholder({ name }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-zinc-500 text-lg">{name} — coming soon</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { authenticated } = useAuth();
  if (!authenticated && !getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="leads" element={<Placeholder name="Leads" />} />
        <Route path="leads/:id" element={<Placeholder name="Lead Detail" />} />
        <Route path="pipeline" element={<Placeholder name="Pipeline" />} />
        <Route path="outreach" element={<Placeholder name="Outreach" />} />
        <Route path="bookings" element={<Placeholder name="Bookings" />} />
        <Route path="calls" element={<Placeholder name="Calls" />} />
        <Route path="calls/:id" element={<Placeholder name="Call Detail" />} />
        <Route path="follow-ups" element={<Placeholder name="Follow-ups" />} />
        <Route path="committed" element={<Placeholder name="Committed" />} />
        <Route path="enrolled" element={<Placeholder name="Enrolled" />} />
        <Route path="analytics" element={<Placeholder name="Analytics" />} />
        <Route path="activity" element={<Placeholder name="Activity" />} />
        <Route path="errors" element={<Placeholder name="Errors" />} />
        <Route path="settings" element={<Placeholder name="Settings" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
