"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { GitBranch, Cpu, Database, Activity, Key, Server, Layers, AppWindow } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface IntegrationsState {
  github: boolean;
  eks: boolean;
  aks: boolean;
  aws_ec2: boolean;
  azure_vm: boolean;
  azure_vmss: boolean;
  azure_app_service: boolean;
}

export default function IntegrationsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<IntegrationsState>({ 
    github: false, eks: false, aks: false, aws_ec2: false, azure_vm: false, azure_vmss: false, azure_app_service: false 
  });
  const [activeModal, setActiveModal] = useState<"github" | "eks" | "aks" | "aws_ec2" | "azure_vm" | "azure_vmss" | "azure_app_service" | null>(null);
  
  // Modal Fields
  const [githubPat, setGithubPat] = useState("");
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

  const handleToggleConnect = async (service: keyof IntegrationsState, isConnect: boolean, credentials?: any) => {
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
      setGithubPat("");
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

  const renderCard = (
    key: keyof IntegrationsState, 
    title: string, 
    desc: string, 
    icon: any, 
    color: string, 
    bg: string, 
    modalKey?: string
  ) => {
    const isConnected = status[key];
    const Icon = icon;
    
    return (
      <div className="glass-panel border border-slate-800 rounded-xl p-6 flex flex-col justify-between" key={key}>
        <div>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 bg-slate-800 rounded-lg ${color}`}>
              <Icon size={22} />
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
            }`}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <h3 className="text-white font-semibold text-lg mb-1">{title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
        </div>
        <button
          onClick={() => {
            if (isConnected) {
              handleToggleConnect(key, false);
            } else {
              if (modalKey) {
                setActiveModal(key as any);
              } else {
                handleToggleConnect(key, true);
              }
            }
          }}
          className={`mt-6 w-full py-2 rounded-lg text-xs font-semibold tracking-wide border cursor-pointer transition-all ${
            isConnected 
              ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
              : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
          }`}
        >
          {isConnected ? `Disconnect ${title}` : (modalKey ? "Configure Connection" : "Connect Now")}
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans pb-10">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-white">Central Connections & Integrations</h2>
          <p className="text-sm text-slate-500 mt-1">
            Securely link your cloud infrastructure and repository services to enable zero-code log streaming and autonomous event analysis.
          </p>
        </div>

        <h3 className="text-sm font-semibold text-slate-300 mt-4 border-b border-slate-800 pb-2">Version Control</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderCard("github", "GitHub Integration", "Connect your source repositories to automatically log releases and capture workflow runs.", GitBranch, "text-indigo-400", "bg-indigo-400/10", "github")}
        </div>

        <h3 className="text-sm font-semibold text-slate-300 mt-6 border-b border-slate-800 pb-2">AWS Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderCard("eks", "AWS EKS Cluster", "Stream EKS container console logs directly from CloudWatch.", Cpu, "text-amber-400", "bg-amber-400/10", "aws")}
          {renderCard("aws_ec2", "AWS EC2 Instances", "Monitor virtual machines and analyze system logs across EC2 instances.", Server, "text-orange-400", "bg-orange-400/10", "aws")}
        </div>

        <h3 className="text-sm font-semibold text-slate-300 mt-6 border-b border-slate-800 pb-2">Azure Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderCard("aks", "Azure AKS Cluster", "Forward AKS container logs by providing service credentials.", Database, "text-sky-400", "bg-sky-400/10", "azure")}
          {renderCard("azure_vm", "Azure Virtual Machines", "Link Azure VMs for deep log analysis and performance metrics.", Server, "text-blue-400", "bg-blue-400/10", "azure")}
          {renderCard("azure_vmss", "Azure VM Scale Sets", "Monitor auto-scaling node groups and instance telemetry.", Layers, "text-cyan-400", "bg-cyan-400/10", "azure")}
          {renderCard("azure_app_service", "Azure App Services", "Integrate web apps to capture application logs and traces.", AppWindow, "text-teal-400", "bg-teal-400/10", "azure")}
        </div>

        {/* GitHub Modal */}
        {activeModal === "github" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <GitBranch className="text-indigo-400" /> Connect GitHub
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide a Personal Access Token (PAT) with read access to repositories. This allows NexusAI to fetch recent deployment commits for Predictive RCA.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Personal Access Token</label>
                  <input
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
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
                  onClick={() => handleToggleConnect("github", true, { pat: githubPat })}
                  disabled={!githubPat}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Verify & Connect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AWS Modal */}
        {(activeModal === "eks" || activeModal === "aws_ec2") && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="text-amber-400" /> Connect AWS {activeModal === "eks" ? "EKS" : "EC2"}
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
                  onClick={() => handleToggleConnect(activeModal as keyof IntegrationsState, true, { role_arn: awsRole, region: awsRegion })}
                  disabled={!awsRole}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Verify & Connect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Azure Modal */}
        {(activeModal === "aks" || activeModal === "azure_vm" || activeModal === "azure_vmss" || activeModal === "azure_app_service") && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="text-sky-400" /> Connect Azure Resource
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
                  onClick={() => handleToggleConnect(activeModal as keyof IntegrationsState, true, { client_id: azureClient, client_secret: azureSecret, tenant_id: azureTenant })}
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
