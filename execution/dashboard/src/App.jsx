import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getToken } from "./api";
import Layout from "./Layout";
import Login from "./components/Login";
import Home from "./pages/Home";
import Leads from "./pages/Leads";
import LeadDetailPage from "./pages/LeadDetailPage";
import PipelinePage from "./pages/PipelinePage";
import Calls from "./pages/Calls";
import FollowUps from "./pages/FollowUps";
import Outreach from "./pages/Outreach";
import Bookings from "./pages/Bookings";
import Analytics from "./pages/Analytics";
import Committed from "./pages/Committed";
import Enrolled from "./pages/Enrolled";
import Settings from "./pages/Settings";

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
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="outreach" element={<Outreach />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="calls" element={<Calls />} />
        <Route path="calls/:id" element={<Placeholder name="Call Detail" />} />
        <Route path="follow-ups" element={<FollowUps />} />
        <Route path="committed" element={<Committed />} />
        <Route path="enrolled" element={<Enrolled />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="activity" element={<Placeholder name="Activity" />} />
        <Route path="errors" element={<Placeholder name="Errors" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
