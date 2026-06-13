"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchApi } from "@/lib/api";
import { Cloud, Server, Database, Activity, CheckCircle, RefreshCw, ServerCog, Cpu, Hexagon } from "lucide-react";
import Link from "next/link";

interface CloudResource {
  id: string;
  name: string;
  type: string;
  provider: "AWS" | "Azure";
  region: string;
  status: string;
  selected: boolean;
}

export default function CloudResourcesDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [integrations, setIntegrations] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    
    Promise.all([
      fetchApi("/api/v1/integrations").catch(() => ({})),
      fetchApi("/api/v1/cloud/resources").catch(() => [])
    ]).then(([integData, resData]) => {
      setIntegrations(integData);
      setResources(Array.isArray(resData) ? resData : []);
      setLoading(false);
    });
  }, [router]);

  const handleToggleSelection = (id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleSaveSelection = async () => {
    setSaving(true);
    try {
      const selectedIds = resources.filter(r => r.selected).map(r => r.id);
      await fetchApi("/api/v1/cloud/resources/select", {
        method: "POST",
        body: JSON.stringify({ selected_ids: selectedIds })
      });
      alert("Cloud resources successfully synchronized with Nexus AI Engine!");
    } catch (err: any) {
      alert(err.message || "Failed to save selections");
    } finally {
      setSaving(false);
    }
  };

  const hasCloudConnected = integrations.aws || integrations.azure;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <Activity className="animate-spin text-indigo-500 w-8 h-8" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasCloudConnected) {
    return (
      <DashboardLayout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
            <Cloud className="text-slate-500 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No Cloud Accounts Connected</h2>
          <p className="text-slate-400 max-w-md mb-8">
            Connect your AWS or Azure accounts in the Integrations settings to automatically discover and monitor your cloud infrastructure.
          </p>
          <Link href="/integrations" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Configure Integrations
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const awsResources = resources.filter(r => r.provider === "AWS");
  const azureResources = resources.filter(r => r.provider === "Azure");

  const renderResourceCard = (r: CloudResource) => {
    const isAws = r.provider === "AWS";
    const Icon = r.type.includes("EKS") || r.type.includes("AKS") ? Cpu : r.type.includes("VM") || r.type.includes("EC2") ? Server : Hexagon;
    const color = isAws ? "text-amber-400" : "text-sky-400";
    const bg = isAws ? "bg-amber-400/10" : "bg-sky-400/10";
    
    return (
      <div 
        key={r.id} 
        onClick={() => handleToggleSelection(r.id)}
        className={`glass-panel border-2 rounded-xl p-5 cursor-pointer transition-all relative overflow-hidden group ${
          r.selected ? "border-indigo-500 bg-indigo-500/5" : "border-slate-800 hover:border-slate-700 hover:bg-white/5"
        }`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-lg ${bg} ${color}`}>
            <Icon size={20} />
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            r.selected ? "border-indigo-500 bg-indigo-500" : "border-slate-600"
          }`}>
            {r.selected && <CheckCircle size={12} className="text-white" />}
          </div>
        </div>
        <h4 className="text-white font-medium text-sm truncate" title={r.name}>{r.name}</h4>
        <div className="flex items-center space-x-2 mt-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider">{r.type}</span>
          <span className="text-[10px] text-slate-500 font-mono">{r.region}</span>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full font-sans pb-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Cloud Resources Dashboard</h1>
            <p className="text-sm text-slate-400">
              Select the cloud instances, clusters, and databases you want Nexus AI to actively monitor and analyze.
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw size={16} /> Refresh Data
            </button>
            <button 
              onClick={handleSaveSelection}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <Activity size={16} className="animate-spin" /> : <ServerCog size={16} />}
              Save Active Monitor List
            </button>
          </div>
        </div>

        {resources.length === 0 ? (
          <div className="glass-panel border border-slate-800 rounded-xl p-10 flex flex-col items-center justify-center text-center mt-4">
            <Cloud className="text-slate-500 w-10 h-10 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Resources Found</h3>
            <p className="text-sm text-slate-400 max-w-md">
              We couldn't find any supported cloud resources (like Virtual Machines or Clusters) in your connected accounts, or Nexus AI does not have permission to view them.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {integrations.aws && (
              <div>
                <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 glow-orange"></div>
                  <h3 className="text-base font-semibold text-slate-200">Amazon Web Services (AWS)</h3>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full font-mono">{awsResources.length} items</span>
                </div>
                {awsResources.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {awsResources.map(renderResourceCard)}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic px-4">No compatible AWS resources found in this region.</p>
                )}
              </div>
            )}

            {integrations.azure && (
              <div>
                <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-2">
                  <div className="w-2 h-2 rounded-full bg-sky-400 glow-blue"></div>
                  <h3 className="text-base font-semibold text-slate-200">Microsoft Azure</h3>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full font-mono">{azureResources.length} items</span>
                </div>
                {azureResources.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {azureResources.map(renderResourceCard)}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic px-4">No compatible Azure resources found in this tenant.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
