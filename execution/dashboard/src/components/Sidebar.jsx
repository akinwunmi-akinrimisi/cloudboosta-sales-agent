import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Columns3,
  Send,
  CalendarDays,
  Phone,
  Clock,
  CheckCircle,
  GraduationCap,
  BarChart3,
  Activity,
  AlertTriangle,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../AuthContext";

const NAV_ITEMS = [
  { label: "Dashboard",  path: "/",           icon: LayoutDashboard, exact: true  },
  { label: "Leads",      path: "/leads",       icon: Users                         },
  { label: "Pipeline",   path: "/pipeline",    icon: Columns3                      },
  { label: "Outreach",   path: "/outreach",    icon: Send                          },
  { label: "Bookings",   path: "/bookings",    icon: CalendarDays                  },
  { label: "Calls",      path: "/calls",       icon: Phone                         },
  { label: "Follow-ups", path: "/follow-ups",  icon: Clock                         },
  { label: "Committed",  path: "/committed",   icon: CheckCircle                   },
  { label: "Enrolled",   path: "/enrolled",    icon: GraduationCap                 },
  { label: "Analytics",  path: "/analytics",   icon: BarChart3                     },
  { label: "Activity",   path: "/activity",    icon: Activity                      },
  { label: "Errors",     path: "/errors",      icon: AlertTriangle, isErrors: true },
];

function NavItem({ item, collapsed, errorCount }) {
  const location = useLocation();

  const isActive = item.exact
    ? location.pathname === item.path
    : location.pathname.startsWith(item.path);

  const Icon = item.icon;
  const showBadge = item.isErrors && errorCount > 0;

  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={`
        relative flex items-center gap-3 rounded-lg transition-colors
        ${collapsed ? "w-9 h-9 justify-center" : "w-full px-3 py-2"}
        ${
          isActive
            ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill border border-transparent"
        }
      `}
    >
      <span className="relative flex-shrink-0">
        <Icon size={18} strokeWidth={1.75} />
        {showBadge && collapsed && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </span>

      {!collapsed && (
        <span className="text-sm font-medium leading-none truncate flex-1">
          {item.label}
        </span>
      )}

      {!collapsed && showBadge && (
        <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
          {errorCount > 99 ? "99+" : errorCount}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({ collapsed = false, errorCount = 0 }) {
  const { logout } = useAuth();
  const location = useLocation();

  const isSettingsActive = location.pathname.startsWith("/settings");

  return (
    <aside
      className={`
        flex-shrink-0 flex flex-col
        bg-surface border-r border-glass-border
        py-4 transition-all duration-200
        ${collapsed ? "w-14 items-center" : "w-60"}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 mb-6 ${collapsed ? "justify-center px-0" : "px-4"}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          J
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">
            John CRM
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className={`flex flex-col gap-1 flex-1 overflow-y-auto ${collapsed ? "items-center px-0" : "px-3"}`}>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            errorCount={errorCount}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className={`mt-4 pt-4 border-t border-glass-border flex flex-col gap-1 ${collapsed ? "items-center px-0" : "px-3"}`}>
        {/* Settings */}
        <Link
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={`
            flex items-center gap-3 rounded-lg transition-colors
            ${collapsed ? "w-9 h-9 justify-center" : "w-full px-3 py-2"}
            ${
              isSettingsActive
                ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill border border-transparent"
            }
          `}
        >
          <Settings size={18} strokeWidth={1.75} className="flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium leading-none">Settings</span>
          )}
        </Link>

        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? "Logout" : undefined}
          className={`
            flex items-center gap-3 rounded-lg transition-colors border border-transparent
            text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill
            ${collapsed ? "w-9 h-9 justify-center" : "w-full px-3 py-2"}
          `}
        >
          <LogOut size={18} strokeWidth={1.75} className="flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium leading-none">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}
