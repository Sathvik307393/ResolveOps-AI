"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { Activity, Settings, MoreHorizontal, Sun, Sunset, Moon, Cpu, GitBranch, Server, Code, Copy, Check, ShieldAlert } from "lucide-react";
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

function generateSparklinePath(logs: any[], width = 100, height = 40) {
  if (!logs || logs.length === 0) {
    return `M0 ${height/2} L${width} ${height/2}`;
  }
  
  const buckets = Array(10).fill(0);
  logs.forEach((log, i) => {
    const bucketIdx = Math.min(9, Math.floor((i / logs.length) * 10));
    if (log.level !== "ERROR" && log.level !== "CRITICAL" && log.level !== "FATAL") {
      buckets[bucketIdx]++;
    }
  });

  const maxPoints = Math.max(...buckets) || 1;
  const points = buckets.map((val, i) => {
    const x = (i / 9) * width;
    const y = height - ((val / maxPoints) * height * 0.8) - (height * 0.1); 
    return `${x},${y}`;
  });

  return `M ${points[0]} C ${points[1]} ${points[2]}, S ${points[3]} ${points[4]}, S ${points[5]} ${points[6]}, S ${points[7]} ${points[9]}`;
}

interface ServiceCardData {
  id: string;
  name: string;
  type: "k8s" | "github" | "custom";
  icon: any;
  health: number;
  warnings: number;
  errors: number;
  avgLatency: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
}

export default function AICommandCenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceCardData | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const payload = decodeJwtPayload(token);
    setFullName(payload.full_name || payload.email || "");

    Promise.all([
      fetchApi("/api/v1/incidents").catch(() => []),
      fetchApi("/api/v1/logs").catch(() => []),
      fetchApi("/api/v1/metrics").catch(() => [])
    ]).then(([incidentsData, logsData, metricsData]) => {
      setIncidents(Array.isArray(incidentsData) ? incidentsData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setMetrics(Array.isArray(metricsData) ? metricsData : []);
      setLoading(false);
    });
  }, [router]);

  const { text: greetingText, Icon: GreetingIcon } = getGreeting();
  const firstName = fullName.split(" ")[0];

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
  const scoreColorClass = isDegraded ? "rose-500" : "emerald-500";

  // Map backend metrics with visual cards
  const serviceCards = useMemo<ServiceCardData[]>(() => {
    const list: ServiceCardData[] = [
      {
        id: "k8s",
        name: "AKS/EKS Cluster",
        type: "k8s",
        icon: Cpu,
        health: 98,
        warnings: 0,
        errors: activeIncidents.filter(i => i.service === "kubernetes").length,
        avgLatency: 15,
        status: activeIncidents.some(i => i.service === "kubernetes") ? "CRITICAL" : "NORMAL"
      },
      {
        id: "github",
        name: "GitHub Workflows",
        type: "github",
        icon: GitBranch,
        health: 100,
        warnings: 0,
        errors: activeIncidents.filter(i => i.service === "github-actions").length,
        avgLatency: 0,
        status: activeIncidents.some(i => i.service === "github-actions") ? "CRITICAL" : "NORMAL"
      }
    ];

    metrics.forEach(m => {
      if (m.service !== "kubernetes" && m.service !== "github-actions" && m.service !== "unknown") {
        list.push({
          id: m.service,
          name: m.service,
          type: "custom",
          icon: Server,
          health: m.health_score,
          warnings: m.warnings,
          errors: m.errors,
          avgLatency: m.avg_latency,
          status: m.errors > 0 ? "CRITICAL" : m.warnings > 0 ? "WARNING" : "NORMAL"
        });
      }
    });

    return list;
  }, [metrics, activeIncidents]);

  const handleCopyCode = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const getIntegrationCode = (service: ServiceCardData) => {
    if (service.type === "k8s") {
      return `kubectl create secret generic nexus-secret \\
  --namespace=kube-system \\
  --from-literal=api-key="nx_live_default_key_token"

kubectl apply -f https://nexusai.sathvikdevops.online/k8s-agent.yaml`;
    }
    if (service.type === "github") {
      return `name: NexusAI Deployment Sync
on:
  push:
    branches: [ main ]
jobs:
  nexus-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Report to Nexus
        run: |
          curl -X POST "https://nexusai.sathvikdevops.online/api/v1/github/webhook" \\
            -H "Authorization: Bearer nx_live_default_key_token" \\
            -d '{"commit_sha":"\${{ github.sha }}","author":"\${{ github.actor }}","repository":"\${{ github.repository }}"}'`;
    }
    return `from fastapi import FastAPI
from nexus_aiops.middleware import NexusTelemetryMiddleware

app = FastAPI()

app.add_middleware(
    NexusTelemetryMiddleware,
    api_key="nx_live_default_key_token",
    service_name="${service.name}"
)`;
  };

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
        <p className="text-sm text-slate-500 mb-6 font-sans">Autonomous AIOps command center. Select any card to configure plug-and-play triggers or view live telemetry metrics.</p>

        {/* Top Header & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Active Incidents Banner */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between border-t border-t-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0"></div>
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">Nexus AI Incident Command Center</h2>
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
               <div className="relative w-32 h-20 flex flex-col items-center justify-end overflow-hidden">
                  <div className={`absolute top-0 w-32 h-32 rounded-full border-8 border-${scoreColorClass}/20 border-t-${scoreColorClass} border-l-${scoreColorClass} transform rotate-45 glow-green`}></div>
                 <div className="text-center z-10 pb-2">
                   <div className="text-3xl font-bold text-white">{reliabilityScore.toFixed(1)}%</div>
                   <div className={`text-[10px] font-bold text-${scoreColorClass} tracking-widest mt-1`}>
                     {isDegraded ? "DEGRADED" : "NORMAL"}
                   </div>
                 </div>
               </div>
               <div className="flex-1 ml-4 h-12 flex items-end justify-between space-x-1">
                 <div className="w-full h-full relative">
                    <svg viewBox="0 0 100 40" className="w-full h-full stroke-emerald-400 fill-none" strokeWidth="2">
                      <path d={generateSparklinePath(logs)} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] opacity-90 transition-opacity" />
                    </svg>
                 </div>
               </div>
             </div>
          </div>
        </div>

        {/* ─── Service Cards Grid Section ────────────────────────────────────────── */}
        <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">Active System Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {serviceCards.map((service, index) => {
            const Icon = service.icon;
            const statusColor = service.status === "CRITICAL" ? "border-rose-500" : service.status === "WARNING" ? "border-amber-500" : "border-slate-800";
            const statusBadge = service.status === "CRITICAL" ? "bg-rose-500/20 text-rose-400" : service.status === "WARNING" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400";
            return (
              <div
                key={service.id}
                onClick={() => setSelectedService(service)}
                className={`glass-panel border ${statusColor} rounded-xl p-5 cursor-pointer hover:bg-white/5 transition-opacity duration-300 relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4`}
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-800/80 rounded-lg text-indigo-400">
                    <Icon size={20} />
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge}`}>
                    {service.status}
                  </span>
                </div>
                <h4 className="text-white font-medium text-base mb-1">{service.name}</h4>
                <div className="flex justify-between text-xs text-slate-500 mt-4">
                  <span>Health: <strong className="text-slate-300">{service.health}%</strong></span>
                  <span>Latency: <strong className="text-slate-300">{service.avgLatency}ms</strong></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Split Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[400px]">
          {/* Incident Analysis Detail */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col border border-slate-800/80 relative">
            {focalIncident ? (
              <>
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500/0 via-rose-500 to-rose-500/0"></div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-lg text-white font-semibold mb-1">Incident Analysis: {focalIncident.incident_id}</h2>
                    <h3 className="text-sm text-slate-400">({focalIncident.service})</h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    focalIncident.severity === "CRITICAL" ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                  }`}>
                    {focalIncident.severity}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6 text-xs text-slate-400">
                  <div className="border-r border-slate-800 pr-4">
                    <p className="text-slate-500 mb-1">Status</p>
                    <p className="text-slate-200 font-semibold">{focalIncident.status}</p>
                  </div>
                  <div className="border-r border-slate-800 px-4">
                    <p className="text-slate-500 mb-1">Affected Service</p>
                    <p className="text-slate-200 font-semibold">{focalIncident.service}</p>
                  </div>
                  <div className="pl-4">
                    <p className="text-slate-500 mb-1">Created At</p>
                    <p className="text-slate-200 font-semibold">{new Date(focalIncident.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h4 className="text-slate-300 text-sm font-semibold mb-2">Root Cause Analysis Report</h4>
                  {focalIncident.rca_report ? (
                    <div className="bg-[#020617] rounded-lg border border-slate-800/80 p-4 text-slate-300 font-mono text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
                      {focalIncident.rca_report}
                    </div>
                  ) : (
                    <div className="bg-[#020617] rounded-lg border border-slate-800/80 p-4 text-slate-500 text-xs italic flex items-center justify-center h-24">
                      RCA report ready in Chat Copilot or completed details sent via alert email.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <ShieldAlert className="text-emerald-500 w-6 h-6" />
                </div>
                <h2 className="text-base text-white font-medium mb-1">Systems Operational</h2>
                <p className="text-slate-400 text-xs max-w-sm">No active incidents detected. The Nexus AI engine is actively monitoring telemetry logs.</p>
              </div>
            )}
          </div>

          {/* Active Incidents List */}
          <div className="glass-panel rounded-xl flex flex-col border border-slate-800/80">
            <div className="p-4 border-b border-slate-800/50 flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">ACTIVE INCIDENTS</h3>
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">{activeIncidents.length}</div>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1 max-h-[350px]">
              {activeIncidents.length === 0 && (
                <div className="text-center text-slate-500 text-xs mt-10">No active incidents</div>
              )}
              {activeIncidents.map((incident, idx) => {
                const isCritical = incident.severity === "CRITICAL" || incident.severity === "FATAL";
                return (
                  <div 
                    key={idx} 
                    className="bg-black/20 rounded-lg border border-slate-800 p-3 relative overflow-hidden transition-all hover:bg-white/5 cursor-pointer"
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${isCritical ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                    <div className="flex justify-between items-start ml-2 mb-1">
                      <span className="font-bold text-white text-xs">{incident.incident_id}</span>
                      <span className="text-[10px] text-slate-500">{new Date(incident.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="ml-2 flex flex-col items-start space-y-1">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
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

        {/* ─── Plug-and-Play / Metrics Modal ────────────────────────────────────────── */}
        {selectedService && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden relative shadow-2xl flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-6 border-b border-slate-800/80 flex justify-between items-center bg-black/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-slate-800 rounded-lg text-indigo-400">
                    {(() => {
                      const Icon = selectedService.icon;
                      return <Icon size={20} />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-none">{selectedService.name} Integration</h3>
                    <p className="text-xs text-slate-500 mt-1">Status: {selectedService.status} · Health Score: {selectedService.health}%</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedService(null)}
                  className="text-slate-400 hover:text-white text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Micro Metrics Section */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Service Health Metrics</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/40 border border-slate-800/60 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-500 mb-1">Average Latency</p>
                      <p className="text-2xl font-bold text-white">{selectedService.avgLatency}ms</p>
                    </div>
                    <div className="bg-black/40 border border-slate-800/60 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-500 mb-1">Warnings (1h)</p>
                      <p className="text-2xl font-bold text-amber-400">{selectedService.warnings}</p>
                    </div>
                    <div className="bg-black/40 border border-slate-800/60 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-500 mb-1">Active Outages</p>
                      <p className={`text-2xl font-bold ${selectedService.errors > 0 ? "text-rose-500" : "text-emerald-500"}`}>{selectedService.errors}</p>
                    </div>
                  </div>
                </div>

                {/* Plug and Play Copy Template */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Code size={14} className="text-indigo-400" /> Plug-and-Play Integration Template
                    </h4>
                    <button
                      onClick={() => handleCopyCode(getIntegrationCode(selectedService))}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedText ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedText ? "Copied!" : "Copy Template"}
                    </button>
                  </div>
                  <pre className="bg-[#020617] border border-white/10 rounded-xl p-4 overflow-x-auto font-mono text-xs text-slate-300 whitespace-pre">
                    {getIntegrationCode(selectedService)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
    </DashboardLayout>
  );
}
