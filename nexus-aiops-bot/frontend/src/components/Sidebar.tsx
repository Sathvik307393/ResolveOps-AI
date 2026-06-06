"use client";

import { usePathname, useRouter } from "next/navigation";
import { Cpu, GitBranch, LayoutDashboard, MessageSquareCode, Lightbulb, BarChart3, Settings, LogOut, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [history, setHistory] = useState<string[]>([]);

  const loadHistory = () => {
    const token = typeof window !== 'undefined' && localStorage.getItem("jwt_token");
    if (!token) return;
    
    fetchApi("/chat/history")
      .then((res: any) => {
        if (Array.isArray(res)) {
          const userMessages = res.filter((m: any) => m.role === "user");
          const uniqueQueries: string[] = [];
          const seen = new Set<string>();
          for (let i = userMessages.length - 1; i >= 0; i--) {
            const query = userMessages[i].content;
            if (query && !seen.has(query)) {
              seen.add(query);
              uniqueQueries.push(query);
            }
          }
          setHistory(uniqueQueries.slice(0, 5));
        }
      })
      .catch((err) => console.error("Failed to load sidebar chat history:", err));
  };

  useEffect(() => {
    loadHistory();

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
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "K8s Explorer", path: "/kubernetes", icon: Cpu },
    { name: "GitHub Sync", path: "/github", icon: GitBranch },
    { name: "AI Copilot", path: "/chat", icon: MessageSquareCode },
    { name: "Suggestions", path: "/suggestions", icon: Lightbulb },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Integrations", path: "/integrations", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/50 glass-panel flex flex-col z-10 m-4 rounded-xl overflow-hidden shrink-0">
      {/* Logo Area */}
      <div className="p-6 flex items-center space-x-3 mb-4">
        <div className="text-indigo-500">
          <Cpu size={32} />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight leading-none text-white">Nexus AI</h1>
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

        {/* Recent Chats Section */}
        {history.length > 0 && (
          <div className="pt-4 border-t border-slate-800/50 mt-4 px-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Recent Queries</p>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {history.map((query, index) => (
                <Link key={index} href={`/chat?q=${encodeURIComponent(query)}`}>
                  <div className="w-full flex items-center space-x-2 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-indigo-300 hover:bg-white/5 transition-all truncate cursor-pointer">
                    <MessageSquare size={12} className="shrink-0 text-slate-500" />
                    <span className="truncate" title={query}>{query}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
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
