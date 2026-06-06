"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Server, Box, Terminal, Activity, Layers, Cpu, Database } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface NodeData {
  name: string;
  status: string;
  cpu_util: string;
  mem_util: string;
}

interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  cpu: string;
  mem: string;
}

interface DeploymentData {
  name: string;
  desired: number;
  ready: number;
  updated: number;
}

interface K8sClusterData {
  cluster_id: string;
  provider: string;
  region: string;
  nodes: NodeData[];
  pods: PodData[];
  deployments: DeploymentData[];
}

export default function KubernetesExplorer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"nodes" | "pods" | "deployments">("pods");
  const [clusterData, setClusterData] = useState<K8sClusterData | null>(null);
  const [selectedPod, setSelectedPod] = useState<PodData | null>(null);
  const [podLogs, setPodLogs] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchApi("/api/v1/k8s/resources")
      .then((data) => {
        setClusterData(data);
        if (data?.pods?.length > 0) {
          setSelectedPod(data.pods[0]);
          generateMockLogs(data.pods[0].name);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const generateMockLogs = (podName: string) => {
    const messages = [
      `INFO [2026-06-06 17:10:01] Starting container listener for ${podName}...`,
      `INFO [2026-06-06 17:10:02] Loading configuration settings.`,
      `INFO [2026-06-06 17:10:04] Database connection pool established successfully.`,
      `DEBUG [2026-06-06 17:10:05] Memory utilization currently at 42.8%`,
      `INFO [2026-06-06 17:11:10] Ingress request received: GET /healthz - 200 OK`,
      `INFO [2026-06-06 17:12:15] Ingress request received: POST /v1/telemetry - 202 Ingested`,
    ];
    setPodLogs(messages);
  };

  const handleSelectPod = (pod: PodData) => {
    setSelectedPod(pod);
    generateMockLogs(pod.name);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="animate-spin text-indigo-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white">Kubernetes Cluster Explorer</h2>
            <p className="text-sm text-slate-500 mt-1">
              Active telemetry context for EKS/AKS resources: {clusterData?.cluster_id} · Region: {clusterData?.region}
            </p>
          </div>
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-white/5 text-xs text-indigo-400 font-semibold font-mono">
            {clusterData?.provider}
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex space-x-2 border-b border-slate-800 pb-px">
          {(["nodes", "pods", "deployments"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold capitalize transition-all border-b-2 cursor-pointer ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-400 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Dynamic Table & Terminal grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Tab Table Display */}
          <div className="lg:col-span-2 glass-panel rounded-xl border border-slate-800/80 overflow-hidden min-h-[400px]">
            {activeTab === "nodes" && (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/35 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Node Name</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">CPU Allocation</th>
                    <th className="p-4 font-semibold">Memory Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {clusterData?.nodes.map((n, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono text-xs text-indigo-300">{n.name}</td>
                      <td className="p-4">
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                          {n.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">{n.cpu_util}</td>
                      <td className="p-4 text-slate-300">{n.mem_util}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "pods" && (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/35 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Pod ID</th>
                    <th className="p-4 font-semibold">Namespace</th>
                    <th className="p-4 font-semibold">State</th>
                    <th className="p-4 font-semibold">Restarts</th>
                    <th className="p-4 font-semibold">CPU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {clusterData?.pods.map((p, i) => {
                    const isSelected = selectedPod?.name === p.name;
                    return (
                      <tr
                        key={i}
                        onClick={() => handleSelectPod(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-600/10 hover:bg-indigo-600/15" : "hover:bg-white/5"
                        }`}
                      >
                        <td className="p-4 font-mono text-xs text-indigo-300">{p.name}</td>
                        <td className="p-4 text-slate-400 text-xs">{p.namespace}</td>
                        <td className="p-4">
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            {p.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300">{p.restarts}</td>
                        <td className="p-4 text-slate-300">{p.cpu}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeTab === "deployments" && (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/35 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Deployment ID</th>
                    <th className="p-4 font-semibold">Desired Pods</th>
                    <th className="p-4 font-semibold">Ready Pods</th>
                    <th className="p-4 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {clusterData?.deployments.map((d, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono text-xs text-indigo-300">{d.name}</td>
                      <td className="p-4 text-slate-300">{d.desired}</td>
                      <td className="p-4 text-emerald-400 font-bold">{d.ready}</td>
                      <td className="p-4 text-slate-300">{d.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pod Logs Terminal Panel */}
          <div className="glass-panel rounded-xl overflow-hidden border border-slate-800/80 flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-slate-800 bg-black/30 flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center">
                <Terminal size={14} className="mr-2 text-indigo-400" />
                Stdout Monitor
              </h3>
              {selectedPod && (
                <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-bold">
                  <Activity size={10} className="animate-pulse" />
                  <span>STREAMING</span>
                </span>
              )}
            </div>
            <div className="p-4 flex-1 font-mono text-[11px] leading-relaxed text-indigo-200 bg-[#020617] overflow-y-auto space-y-2">
              {selectedPod ? (
                <>
                  <p className="text-slate-500 italic mb-2"># Output for container: {selectedPod.name}</p>
                  {podLogs.map((log, i) => (
                    <p key={i}>{log}</p>
                  ))}
                </>
              ) : (
                <p className="text-slate-600 italic">Select a pod to monitor logs.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
