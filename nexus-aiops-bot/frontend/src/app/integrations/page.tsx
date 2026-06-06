"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { GitBranch, Cpu, Database, Activity, ShieldCheck, ShieldAlert, Key } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface IntegrationsState {
  github: boolean;
  eks: boolean;
  aks: boolean;
}

export default function IntegrationsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<IntegrationsState>({ github: false, eks: false, aks: false });
  const [activeModal, setActiveModal] = useState<"github" | "eks" | "aks" | null>(null);
  
  // Modal Fields
  const [awsRole, setAwsRole] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [azureTenant, setAzureTenant] = useState("");
  const [azureClient, setAzureClient] = useState("");
  const [azureSecret, setAzureSecret] = useState("");

  const loadIntegrations = () => {
    fetchApi("/api/v1/integrations")
      .then((data) => {
        if (data) setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadIntegrations();
  }, [router]);

  const handleToggleConnect = async (service: "github" | "eks" | "aks", isConnect: boolean, credentials?: any) => {
    try {
      const data = await fetchApi("/api/v1/integrations/connect", {
        method: "POST",
        body: JSON.stringify({
          service,
          connected: isConnect,
          credentials
        })
      });
      if (data?.integrations) {
        setStatus(data.integrations);
      }
      setActiveModal(null);
      // Reset inputs
      setAwsRole("");
      setAzureSecret("");
    } catch (err) {
      alert("Failed to update integration connection");
    }
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
        <div>
          <h2 className="text-xl font-bold tracking-wide text-white">Central Connections & Integrations</h2>
          <p className="text-sm text-slate-500 mt-1">
            Securely link your cloud infrastructure and repository services to enable zero-code log streaming and autonomous event analysis.
          </p>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* GitHub Card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 rounded-lg text-indigo-400">
                  <GitBranch size={22} />
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status.github ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                }`}>
                  {status.github ? "Connected" : "Disconnected"}
                </span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">GitHub Integration</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect your source repositories to automatically log releases, capture workflow runs, and correlate deployment anomalies.
              </p>
            </div>
            <button
              onClick={() => {
                if (status.github) {
                  handleToggleConnect("github", false);
                } else {
                  // Simulate immediate OAuth trigger
                  handleToggleConnect("github", true);
                }
              }}
              className={`mt-6 w-full py-2 rounded-lg text-xs font-semibold tracking-wide border cursor-pointer transition-all ${
                status.github 
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
                  : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
              }`}
            >
              {status.github ? "Disconnect GitHub" : "Connect via OAuth"}
            </button>
          </div>

          {/* AWS EKS Card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 rounded-lg text-amber-400">
                  <Cpu size={22} />
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status.eks ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                }`}>
                  {status.eks ? "Connected" : "Disconnected"}
                </span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">AWS EKS Cluster</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Stream EKS container console logs directly from CloudWatch logs by delegating access via a secure Cross-Account IAM Role ARN.
              </p>
            </div>
            <button
              onClick={() => {
                if (status.eks) {
                  handleToggleConnect("eks", false);
                } else {
                  setActiveModal("eks");
                }
              }}
              className={`mt-6 w-full py-2 rounded-lg text-xs font-semibold tracking-wide border cursor-pointer transition-all ${
                status.eks 
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
                  : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
              }`}
            >
              {status.eks ? "Disconnect EKS" : "Configure Connection"}
            </button>
          </div>

          {/* Azure AKS Card */}
          <div className="glass-panel border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 rounded-lg text-sky-400">
                  <Database size={22} />
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status.aks ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                }`}>
                  {status.aks ? "Connected" : "Disconnected"}
                </span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">Azure AKS Cluster</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Log into Azure Monitor and forward AKS container logs by providing service credentials for an authorized Service Principal.
              </p>
            </div>
            <button
              onClick={() => {
                if (status.aks) {
                  handleToggleConnect("aks", false);
                } else {
                  setActiveModal("aks");
                }
              }}
              className={`mt-6 w-full py-2 rounded-lg text-xs font-semibold tracking-wide border cursor-pointer transition-all ${
                status.aks 
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
                  : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
              }`}
            >
              {status.aks ? "Disconnect AKS" : "Configure Connection"}
            </button>
          </div>
        </div>

        {/* AWS Connection Modal */}
        {activeModal === "eks" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="text-amber-400" /> Connect AWS EKS Cluster
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                NexusAI requires read-only permissions to poll CloudWatch. Create an IAM Role in your AWS console delegating access.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">IAM Role ARN</label>
                  <input
                    type="text"
                    value={awsRole}
                    onChange={(e) => setAwsRole(e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/NexusAccess"
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">AWS Region</label>
                  <input
                    type="text"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-slate-400 hover:text-white text-xs bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleToggleConnect("eks", true, { role_arn: awsRole, region: awsRegion })}
                  disabled={!awsRole}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Verify & Connect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Azure Connection Modal */}
        {activeModal === "aks" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="text-sky-400" /> Connect Azure AKS Cluster
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide Service Principal access credentials to authorize log data forwarding.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Tenant ID</label>
                  <input
                    type="text"
                    value={azureTenant}
                    onChange={(e) => setAzureTenant(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Application (Client) ID</label>
                  <input
                    type="text"
                    value={azureClient}
                    onChange={(e) => setAzureClient(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Client Secret</label>
                  <input
                    type="password"
                    value={azureSecret}
                    onChange={(e) => setAzureSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-slate-400 hover:text-white text-xs bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleToggleConnect("aks", true, { client_id: azureClient, client_secret: azureSecret, tenant_id: azureTenant })}
                  disabled={!azureTenant || !azureClient || !azureSecret}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Verify & Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
