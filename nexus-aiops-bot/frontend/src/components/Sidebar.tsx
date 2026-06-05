"use client";

import { usePathname, useRouter } from "next/navigation";
import { Cpu, LayoutDashboard, ShieldAlert, BarChart3, Users, Settings, LogOut, Lightbulb, MessageSquareCode } from "lucide-react";
import Link from "next/link";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("jwt_token");
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Incidents", path: "/kubernetes", icon: ShieldAlert },
    { name: "AI Copilot", path: "/chat", icon: MessageSquareCode },
    { name: "Suggestions", path: "/suggestions", icon: Lightbulb },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Team", path: "/team", icon: Users },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/50 glass-panel flex flex-col z-10 m-4 rounded-xl overflow-hidden shrink-0">
      {/* Logo Area */}
      <div className="p-6 flex items-center space-x-3 mb-4">
        <div className="text-indigo-500">
          <Cpu size={32} />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight leading-none text-white">AI ICC</h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Incident Command Center</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link key={item.name} href={item.path}>
              <div className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                isActive 
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 glow-primary" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
              }`}>
                <Icon size={18} />
                <span className="font-medium text-sm">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile / Logout */}
      <div className="p-4 mt-auto">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
        >
          <LogOut size={18} />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
