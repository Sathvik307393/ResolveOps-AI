"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { 
  Activity, 
  BarChart3, 
  Cpu, 
  LayoutDashboard, 
  LogOut, 
  MoreHorizontal, 
  Settings, 
  ShieldAlert, 
  Users 
} from "lucide-react";

export default function AICommandCenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // In a real app we'd fetch this. For the layout match, we use state structures.
  const [activeIncidents, setActiveIncidents] = useState([
    {
      id: "#ICC-2023-11-03",
      title: "Prediction_Engine_v4.2",
      severity: "CRITICAL",
      time: "14:38"
    },
    {
      id: "#ICC-2023-11-02",
      title: "DataIngest_Pipeline",
      severity: "WARNING",
      time: "13:55"
    },
    {
      id: "#ICC-2023-11-01",
      title: "Monitoring_Hub",
      severity: "WARNING",
      time: "12:40"
    }
  ]);

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
    <div className="flex min-h-screen text-slate-200">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-64 border-r border-slate-800/50 glass-panel flex flex-col z-10 m-4 rounded-xl overflow-hidden">
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
        <nav className="flex-1 px-4 space-y-2">
          <button className="w-full flex items-center space-x-3 px-4 py-3 bg-indigo-600/20 text-indigo-300 rounded-lg border border-indigo-500/30 glow-primary transition-all">
            <LayoutDashboard size={18} />
            <span className="font-medium text-sm">Dashboard</span>
          </button>
          
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-all">
            <ShieldAlert size={18} />
            <span className="font-medium text-sm">Incidents</span>
          </button>
          
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-all">
            <BarChart3 size={18} />
            <span className="font-medium text-sm">Analytics</span>
          </button>
          
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-all">
            <Users size={18} />
            <span className="font-medium text-sm">Team</span>
          </button>
          
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-all">
            <Settings size={18} />
            <span className="font-medium text-sm">Settings</span>
          </button>
        </nav>

        {/* Bottom Profile / Logout */}
        <div className="p-4 mt-auto">
          <button 
            onClick={() => { localStorage.removeItem("jwt_token"); router.push("/login"); }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto">
        
        {/* Top Header & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Incidents Banner (Spans 2 columns) */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between border-t border-t-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0"></div>
            
            <h2 className="text-xl font-medium tracking-wide text-white mb-6">AI INCIDENT COMMAND CENTER</h2>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-lg text-slate-300">Active Incidents: <span className="text-rose-500 font-bold ml-1">4</span></span>
                <div className="flex space-x-2 ml-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">2 CRITICAL</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">2 WARNING</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs font-bold glow-red">2</div>
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]">2</div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                  <Settings size={14} className="text-slate-400"/>
                </div>
              </div>
            </div>
          </div>

          {/* Reliability Score */}
          <div className="glass-panel rounded-xl p-6 border-t border-t-white/10 relative">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">System Reliability Score:</h3>
               <MoreHorizontal size={16} className="text-slate-500" />
             </div>
             
             <div className="flex items-center justify-between mt-2">
               {/* Arc visualization approximation */}
               <div className="relative w-32 h-20 flex flex-col items-center justify-end overflow-hidden">
                 <div className="absolute top-0 w-32 h-32 rounded-full border-8 border-emerald-500/20 border-t-emerald-500 border-l-emerald-500 transform rotate-45 glow-green"></div>
                 <div className="text-center z-10 pb-2">
                   <div className="text-3xl font-bold text-white">98.4%</div>
                   <div className="text-[10px] font-bold text-emerald-400 tracking-widest mt-1">NORMAL</div>
                 </div>
               </div>
               
               {/* Sparkline approximation */}
               <div className="flex-1 ml-4 h-12 flex items-end justify-between space-x-1">
                 <div className="w-full h-full relative">
                   <svg viewBox="0 0 100 40" className="w-full h-full stroke-emerald-400 fill-none" strokeWidth="2">
                     <path d="M0 30 Q 10 25, 20 28 T 40 20 T 60 15 T 80 18 T 100 5" className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   </svg>
                 </div>
               </div>
             </div>
          </div>

        </div>

        {/* Bottom Split Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
          
          {/* Incident Analysis Detail */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col border border-rose-500/30 glow-red relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500/0 via-rose-500 to-rose-500/0"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl text-white font-medium mb-1">Incident Analysis: #ICC-2023-11-03</h2>
                <h3 className="text-lg text-slate-300">(Anomaly Detection Failure)</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-[0_0_10px_rgba(225,29,72,0.6)]">CRITICAL</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
              <div className="border-r border-slate-700/50 pr-4">
                <p className="text-slate-500 mb-1">Title</p>
                <p className="text-slate-200">Critical</p>
              </div>
              <div className="border-r border-slate-700/50 px-4">
                <p className="text-slate-500 mb-1">Affected:</p>
                <p className="text-slate-200">AI Model: Prediction_Engine_v4.2</p>
              </div>
              <div className="pl-4">
                <p className="text-slate-500 mb-1">Time:</p>
                <p className="text-slate-200">Nov 03, 14:38 UTC</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <h4 className="text-white font-medium mb-3">Root Cause Analysis Report</h4>
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                <span className="font-bold text-white">Root Cause:</span> High latency on vector database queries causing timeouts in model inference pipeline.
              </p>
              
              {/* Terminal Code Block */}
              <div className="flex-1 bg-[#0a0a0f] rounded-lg border border-slate-800 flex flex-col overflow-hidden">
                <div className="h-8 bg-[#151520] border-b border-slate-800 flex items-center px-4 space-x-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                </div>
                <div className="p-4 font-mono text-xs text-slate-400 overflow-auto relative group">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-[10px]">Copy</button>
                  </div>
                  <p><span className="text-rose-400">ERROR</span> [14:38:02] Query timeout executing vector search index</p>
                  <p className="mt-1"><span className="text-indigo-400">INFO</span>  [14:38:05] Attempting automatic failover to read-replica...</p>
                  <p className="mt-1"><span className="text-rose-400">ERROR</span> [14:38:10] Failover rejected: replica set sync lag exceeds 5000ms</p>
                  <p className="mt-1"><span className="text-amber-400">WARN</span>  [14:38:15] Shedding load on Prediction_Engine_v4.2</p>
                </div>
              </div>
            </div>
            
          </div>

          {/* Active Incidents List */}
          <div className="glass-panel rounded-xl flex flex-col border-t border-t-white/10">
            <div className="p-5 border-b border-slate-800/50 flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">ACTIVE INCIDENTS</h3>
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">3</div>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {activeIncidents.map((incident, idx) => {
                const isCritical = incident.severity === "CRITICAL";
                return (
                  <div 
                    key={idx} 
                    className={`bg-black/20 rounded-lg border border-slate-800 p-3 relative overflow-hidden transition-all hover:bg-white/5 cursor-pointer`}
                  >
                    {/* Left Border Indicator */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${isCritical ? 'bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.8)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'}`}></div>
                    
                    <div className="flex justify-between items-start ml-2 mb-2">
                      <span className="font-bold text-white text-sm">{incident.id}</span>
                      <span className="text-[10px] text-slate-500">{incident.time}</span>
                    </div>
                    
                    <div className="ml-2 flex flex-col items-start space-y-1.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {incident.severity}
                      </span>
                      <span className="text-xs text-slate-300">{incident.title}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
