import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { apiFetch } from "./api";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/pipeline": "Pipeline",
  "/outreach": "Outreach",
  "/bookings": "Bookings",
  "/calls": "Calls",
  "/follow-ups": "Follow-ups",
  "/committed": "Committed",
  "/enrolled": "Enrolled",
  "/analytics": "Analytics",
  "/activity": "Activity",
  "/errors": "Errors",
  "/settings": "Settings",
};

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(window.innerWidth < 1200);
  const [callActive, setCallActive] = useState(false);
  const [dialerRunning, setDialerRunning] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Responsive sidebar
  useEffect(() => {
    function handleResize() {
      setCollapsed(window.innerWidth < 1200);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Poll live call + dialer status for topbar indicators
  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const liveData = await apiFetch("/calls/live");
        if (mounted) setCallActive(!!liveData?.active_call);
      } catch {}
      try {
        const dialerData = await apiFetch("/dialer/status");
        if (mounted) setDialerRunning(!!dialerData?.running);
      } catch {}
      try {
        const errData = await apiFetch("/errors");
        if (mounted) setErrorCount(errData?.unresolved_count || 0);
      } catch {}
    }

    poll();
    const interval = setInterval(poll, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Derive page title from path
  const basePath = "/" + (location.pathname.split("/")[1] || "");
  const title = PAGE_TITLES[basePath] || "Dashboard";

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      <Sidebar collapsed={collapsed} errorCount={errorCount} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} dialerRunning={dialerRunning} callActive={callActive} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
