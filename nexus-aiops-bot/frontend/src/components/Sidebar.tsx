"use client";

import { usePathname, useRouter } from "next/navigation";
import { Cloud, Cpu, GitBranch, LayoutDashboard, MessageSquareCode, Lightbulb, BarChart3, Settings, LogOut, MessageSquare, Server, Layers, AppWindow, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [integrations, setIntegrations] = useState<any>({ github: false, aws: false, azure: false });

  const loadHistory = () => {
    const token = typeof window !== 'undefined' && localStorage.getItem("jwt_token");
    if (!token) return;
    
    fetchApi("/api/chat/sessions")
      .then((res: any) => {
        if (Array.isArray(res)) {
          setSessions(res);
        }
      })
      .catch((err) => console.error("Failed to load sidebar chat sessions:", err));
  };

  const loadIntegrations = () => {
    const token = typeof window !== 'undefined' && localStorage.getItem("jwt_token");
    if (!token) return;
    
    fetchApi("/api/v1/integrations")
      .then((data: any) => {
        if (data) setIntegrations(data);
      })
      .catch((err) => console.error("Failed to load integrations status:", err));
  };

  useEffect(() => {
    loadHistory();
    loadIntegrations();

    // Listen to custom updates dispatched from the chat panel
    window.addEventListener("chat-updated", loadHistory);
    return () => {
      window.removeEventListener("chat-updated", loadHistory);
    };
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("jwt_token");
    router.push("/login");
  };

  const navItems = [
    { name: "Cloud Resources", path: "/", icon: LayoutDashboard },
    ...(integrations.github ? [{ name: "GitHub Sync", path: "/github", icon: GitBranch }] : []),
    ...(integrations.azure ? [{ name: "Azure Hub", path: "/azure", icon: Cloud }] : []),
    { name: "AI Copilot", path: "/chat", icon: MessageSquareCode },
    { name: "Suggestions", path: "/suggestions", icon: Lightbulb },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Integrations", path: "/integrations", icon: Settings },
  ];

  return (
    <aside className={`border-r border-slate-800/50 glass-panel flex flex-col z-10 m-4 rounded-xl overflow-hidden shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo Area */}
      <div className={`p-6 flex items-center mb-4 transition-all duration-300 ${isCollapsed ? 'justify-center space-x-0' : 'space-x-3'}`}>
        <div className="text-primary shrink-0">
          <Cpu size={32} />
        </div>
        {!isCollapsed && (
          <div className="animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
            <h1 className="font-bold text-lg tracking-tight leading-none text-slate-100">Nexus AI</h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Command Center</p>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="px-4 mb-2 flex justify-center">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex justify-center items-center py-2 bg-black/20 hover:bg-black/40 text-slate-500 hover:text-slate-300 rounded border border-border/50 transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link key={item.name} href={item.path} title={isCollapsed ? item.name : undefined}>
              <div className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-2.5 rounded-md transition-all ${
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
              }`}>
                <Icon size={18} className="shrink-0" />
                {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>}
              </div>
            </Link>
          );
        })}

        {/* Recent Chats Section */}
        {!isCollapsed && sessions.length > 0 && (
          <div className="pt-4 border-t border-border/50 mt-4 px-2 animate-in fade-in duration-300">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Recent Chats</p>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {sessions.map((session, index) => {
                const dateObj = new Date(session.timestamp);
                const isToday = new Date().toDateString() === dateObj.toDateString();
                const dateLabel = isToday ? "Today" : dateObj.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
                
                return (
                  <Link key={session.session_id} href={`/chat?session_id=${session.session_id}`}>
                    <div className="w-full flex items-center space-x-2 px-2 py-2 rounded text-xs text-slate-400 hover:text-primary hover:bg-white/5 transition-all group">
                      <MessageSquare size={12} className="shrink-0 text-slate-500 group-hover:text-primary" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="truncate font-medium text-slate-300" title={session.title}>{session.title}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{dateLabel}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Profile / Logout */}
      <div className="p-4 mt-auto">
        <button 
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all`}
        >
          <LogOut size={18} className="shrink-0" />
          {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
