"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Search, Server, Box, Terminal, Activity } from "lucide-react";

export default function KubernetesExplorer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Activity className="animate-spin text-primary w-8 h-8"/></div>;
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6">
        <h2 className="text-xl font-medium tracking-wide text-white">Kubernetes Explorer</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Nodes List */}
          <div className="lg:col-span-1 glass-panel rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center"><Server size={14} className="mr-2 text-indigo-400" /> Nodes</h3>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              {['ip-10-0-1-12', 'ip-10-0-2-45'].map((node, i) => (
                <div key={i} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg cursor-pointer transition-all">
                  <div className="font-mono text-sm text-white">{node}</div>
                  <div className="text-[10px] text-emerald-400 mt-1">Ready</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pods List */}
          <div className="lg:col-span-1 glass-panel rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center"><Box size={14} className="mr-2 text-rose-400" /> Pods</h3>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              {[
                { name: 'prediction-engine-v4', status: 'CrashLoopBackOff', color: 'text-rose-400', border: 'border-rose-500/50' },
                { name: 'data-ingest-8f8', status: 'Running', color: 'text-emerald-400', border: 'border-white/5' },
              ].map((pod, i) => (
                <div key={i} className={`p-3 bg-white/5 hover:bg-white/10 border ${pod.border} rounded-lg cursor-pointer transition-all`}>
                  <div className="font-mono text-xs text-white truncate">{pod.name}</div>
                  <div className={`text-[10px] mt-1 font-bold ${pod.color}`}>{pod.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal Viewer */}
          <div className="lg:col-span-2 glass-panel rounded-xl flex flex-col overflow-hidden border border-rose-500/30 glow-red relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500/0 via-rose-500 to-rose-500/0"></div>
            
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center"><Terminal size={14} className="mr-2 text-emerald-400" /> prediction-engine-v4 stdout</h3>
              <div className="flex space-x-2">
                 <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                 <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                 <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              </div>
            </div>
            <div className="flex-1 p-4 font-mono text-xs text-slate-300 bg-[#0a0a0f] overflow-y-auto">
                <p><span className="text-rose-400">ERROR</span> [14:38:02] Query timeout executing vector search index</p>
                <p className="mt-1"><span className="text-indigo-400">INFO</span>  [14:38:05] Attempting automatic failover to read-replica...</p>
                <p className="mt-1"><span className="text-rose-400">ERROR</span> [14:38:10] Failover rejected: replica set sync lag exceeds 5000ms</p>
                <p className="mt-1"><span className="text-rose-400">FATAL</span> [14:38:12] Pod crashed with exit code 1</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
