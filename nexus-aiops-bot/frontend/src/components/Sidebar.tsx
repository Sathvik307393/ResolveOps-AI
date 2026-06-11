"use client";

import { usePathname, useRouter } from "next/navigation";
import { Cpu, GitBranch, LayoutDashboard, MessageSquareCode, Lightbulb, BarChart3, Settings, LogOut, MessageSquare, Server, Layers, AppWindow, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [history, setHistory] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [integrations, setIntegrations] = useState<any>({ github: false, eks: false, aks: false, aws_ec2: false, azure_vm: false, azure_vmss: false, azure_app_service: false });

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
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    ...(integrations.eks || integrations.aks ? [{ name: "K8s Explorer", path: "/kubernetes", icon: Cpu }] : []),
    ...(integrations.aws_ec2 ? [{ name: "AWS EC2 Explorer", path: "/aws/ec2", icon: Server }] : []),
    ...(integrations.azure_vm ? [{ name: "Azure VM Explorer", path: "/azure/vm", icon: Server }] : []),
    ...(integrations.azure_vmss ? [{ name: "Azure VMSS Explorer", path: "/azure/vmss", icon: Layers }] : []),
    ...(integrations.azure_app_service ? [{ name: "App Service Explorer", path: "/azure/app-service", icon: AppWindow }] : []),
    ...(integrations.github ? [{ name: "GitHub Sync", path: "/github", icon: GitBranch }] : []),
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
        {!isCollapsed && history.length > 0 && (
          <div className="pt-4 border-t border-border/50 mt-4 px-2 animate-in fade-in duration-300">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Recent Queries</p>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {history.map((query, index) => (
                <Link key={index} href={`/chat?q=${encodeURIComponent(query)}`}>
                  <div className="w-full flex items-center space-x-2 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-primary hover:bg-white/5 transition-all truncate cursor-pointer">
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
