"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { Activity, Settings, MoreHorizontal, Sun, Sunset, Moon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getGreeting(): { text: string; Icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Good Morning", Icon: Sun };
  if (hour >= 12 && hour < 18) return { text: "Good Afternoon", Icon: Sunset };
  return { text: "Good Evening", Icon: Moon };
}

function decodeJwtPayload(token: string): Record<string, any> {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

// Helper to generate sparkline SVG path based on error densities
function generateSparklinePath(logs: any[], width = 100, height = 40) {
  if (!logs || logs.length === 0) {
    return `M0 ${height/2} L${width} ${height/2}`;
  }
  
  // Group logs into 10 buckets
  const buckets = Array(10).fill(0);
  logs.forEach((log, i) => {
    const bucketIdx = Math.floor((i / logs.length) * 10);
    // If it's not an error, we give it a point. The sparkline represents "health"
    if (log.level !== "ERROR" && log.level !== "CRITICAL" && log.level !== "FATAL") {
      buckets[bucketIdx]++;
    }
  });

  const maxPoints = Math.max(...buckets) || 1; // Prevent divide by zero
  
  const points = buckets.map((val, i) => {
    const x = (i / 9) * width;
    // val / maxPoints gives a percentage height. We invert it so higher health is higher up.
    const y = height - ((val / maxPoints) * height * 0.8) - (height * 0.1); 
    return `${x},${y}`;
  });

  // Create a smooth curve through the points
  return `M ${points[0]} C ${points[1]} ${points[2]}, S ${points[3]} ${points[4]}, S ${points[5]} ${points[6]}, S ${points[7]} ${points[9]}`;
}

export default function AICommandCenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Decode username from JWT payload (client-side, no secret needed)
    const payload = decodeJwtPayload(token);
    setFullName(payload.full_name || payload.email || "");

    // Fetch live data
    Promise.all([
      fetchApi("/api/v1/incidents").catch(() => []),
      fetchApi("/api/v1/logs").catch(() => [])
    ]).then(([incidentsData, logsData]) => {
      setIncidents(Array.isArray(incidentsData) ? incidentsData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setLoading(false);
    });
  }, [router]);

  const { text: greetingText, Icon: GreetingIcon } = getGreeting();
  const firstName = fullName.split(" ")[0];

  // Derived Metrics
  const activeIncidents = useMemo(() => incidents.filter(i => i.status !== "RESOLVED"), [incidents]);
  const criticalCount = activeIncidents.filter(i => i.severity === "CRITICAL" || i.severity === "FATAL").length;
  const warningCount = activeIncidents.filter(i => i.severity === "WARNING" || i.severity === "ERROR").length;
  
  const focalIncident = activeIncidents.length > 0 
    ? activeIncidents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;

  const reliabilityScore = useMemo(() => {
    if (logs.length === 0) return 100;
    const errors = logs.filter(l => l.level === "ERROR" || l.level === "CRITICAL" || l.level === "FATAL").length;
    return Math.max(0, (1 - (errors / logs.length)) * 100);
  }, [logs]);

  const isDegraded = reliabilityScore < 95;
  const scoreColorClass = isDegraded ? "emerald-500" : "emerald-500"; // For simplicity, keep it green but you can change it dynamically

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Activity className="animate-spin text-indigo-500 w-8 h-8"/></div>;
  }

  return (
    <DashboardLayout>
        {/* Greeting Header */}
        <div className="flex items-center space-x-3 mb-2">
          <GreetingIcon size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">
            {greetingText}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <p className="text-sm text-slate-500 mb-4">Here&apos;s what&apos;s happening across your infrastructure right now.</p>

        {/* Top Header & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Incidents Banner (Spans 2 columns) */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between border-t border-t-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0"></div>
            
            <h2 className="text-xl font-medium tracking-wide text-white mb-6 uppercase">Nexus AI Incident Command Center</h2>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-lg text-slate-300">Active Incidents: <span className="text-rose-500 font-bold ml-1">{activeIncidents.length}</span></span>
                <div className="flex space-x-2 ml-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">{criticalCount} CRITICAL</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">{warningCount} WARNING</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs font-bold glow-red">{criticalCount}</div>
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]">{warningCount}</div>
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
               {/* Arc visualization */}
               <div className="relative w-32 h-20 flex flex-col items-center justify-end overflow-hidden">
                 <div className={`absolute top-0 w-32 h-32 rounded-full border-8 border-${scoreColorClass}/20 border-t-${scoreColorClass} border-l-${scoreColorClass} transform rotate-45 glow-green transition-all`}></div>
                 <div className="text-center z-10 pb-2">
                   <div className="text-3xl font-bold text-white">{reliabilityScore.toFixed(1)}%</div>
                   <div className={`text-[10px] font-bold text-${scoreColorClass}-400 tracking-widest mt-1`}>
                     {isDegraded ? "DEGRADED" : "NORMAL"}
                   </div>
                 </div>
               </div>
               
               {/* Dynamic Sparkline */}
               <div className="flex-1 ml-4 h-12 flex items-end justify-between space-x-1">
                 <div className="w-full h-full relative">
                   <svg viewBox="0 0 100 40" className="w-full h-full stroke-emerald-400 fill-none" strokeWidth="2">
                     <path d={generateSparklinePath(logs)} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000" />
                   </svg>
                 </div>
               </div>
             </div>
          </div>

        </div>

        {/* Bottom Split Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
          
          {/* Incident Analysis Detail */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col border border-indigo-500/30 relative">
            
            {focalIncident ? (
              <>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500/0 via-rose-500 to-rose-500/0"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl text-white font-medium mb-1">Incident Analysis: {focalIncident.incident_id}</h2>
                    <h3 className="text-lg text-slate-300">({focalIncident.service})</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
                    focalIncident.severity === "CRITICAL" ? "bg-rose-500 text-white shadow-rose-500/50" : "bg-amber-500 text-white shadow-amber-500/50"
                  }`}>
                    {focalIncident.severity}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
                  <div className="border-r border-slate-700/50 pr-4">
                    <p className="text-slate-500 mb-1">Status</p>
                    <p className="text-slate-200">{focalIncident.status}</p>
                  </div>
                  <div className="border-r border-slate-700/50 px-4">
                    <p className="text-slate-500 mb-1">Affected:</p>
                    <p className="text-slate-200">{focalIncident.service}</p>
                  </div>
                  <div className="pl-4">
                    <p className="text-slate-500 mb-1">Created At:</p>
                    <p className="text-slate-200">{new Date(focalIncident.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <h4 className="text-white font-medium mb-3">Root Cause Analysis Report</h4>
                  {focalIncident.rca_report ? (
                    <div className="bg-[#0a0a0f] rounded-lg border border-slate-800 p-4 text-slate-300 text-sm overflow-auto">
                      {focalIncident.rca_report}
                    </div>
                  ) : (
                    <div className="bg-[#0a0a0f] rounded-lg border border-slate-800 p-4 text-slate-500 text-sm italic flex items-center justify-center h-32">
                      RCA not yet generated. Click analyze to trigger RAG engine.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Activity className="text-emerald-500 w-8 h-8" />
                </div>
                <h2 className="text-xl text-white font-medium mb-2">Systems Operational</h2>
                <p className="text-slate-400 max-w-sm">No active incidents detected. The Nexus AI engine is actively monitoring telemetry logs.</p>
              </div>
            )}
            
          </div>

          {/* Active Incidents List */}
          <div className="glass-panel rounded-xl flex flex-col border-t border-t-white/10">
            <div className="p-5 border-b border-slate-800/50 flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">ACTIVE INCIDENTS</h3>
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">{activeIncidents.length}</div>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {activeIncidents.length === 0 && (
                <div className="text-center text-slate-500 text-sm mt-10">No active incidents</div>
              )}
              {activeIncidents.map((incident, idx) => {
                const isCritical = incident.severity === "CRITICAL" || incident.severity === "FATAL";
                return (
                  <div 
                    key={idx} 
                    className={`bg-black/20 rounded-lg border border-slate-800 p-3 relative overflow-hidden transition-all hover:bg-white/5 cursor-pointer`}
                  >
                    {/* Left Border Indicator */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${isCritical ? 'bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.8)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'}`}></div>
                    
                    <div className="flex justify-between items-start ml-2 mb-2">
                      <span className="font-bold text-white text-sm">{incident.incident_id}</span>
                      <span className="text-[10px] text-slate-500">{new Date(incident.created_at).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="ml-2 flex flex-col items-start space-y-1.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {incident.severity}
                      </span>
                      <span className="text-xs text-slate-300">{incident.service}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
    </DashboardLayout>
  );
}
