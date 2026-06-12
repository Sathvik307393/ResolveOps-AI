"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { GitBranch, Server, Database, Activity, Key, Eye, EyeOff, CheckCircle, ArrowRight } from "lucide-react";
import { fetchApi } from "@/lib/api";
import Link from "next/link";

interface IntegrationsState {
  github: boolean;
  aws: boolean;
  azure: boolean;
}

export default function IntegrationsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<IntegrationsState>({ 
    github: false, aws: false, azure: false
  });
  const [githubDetails, setGithubDetails] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<"github" | "aws" | "azure" | null>(null);
  const [successToast, setSuccessToast] = useState({ show: false, title: "", message: "" });
  
  // Modal Fields
  const [githubPat, setGithubPat] = useState("");
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [azureTenant, setAzureTenant] = useState("");
  const [azureClient, setAzureClient] = useState("");
  const [azureSecret, setAzureSecret] = useState("");
  const [showAzureSecret, setShowAzureSecret] = useState(false);
  const [githubEmail, setGithubEmail] = useState("");
  const [githubToken, setGithubToken] = useState("");

  const loadIntegrations = () => {
    fetchApi("/api/v1/integrations")
      .then((data: any) => {
        if (data) {
          setStatus({
            github: !!data.github,
            aws: !!data.aws,
            azure: !!data.azure
          });
          if (data.github_details) setGithubDetails(data.github_details);
        }
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
        setStatus({
          github: !!data.integrations.github,
          aws: !!data.integrations.aws,
          azure: !!data.integrations.azure
        });
        if (data.integrations.github_details !== undefined) {
          setGithubDetails(data.integrations.github_details);
        }
      }
      if (isConnect) {
        const title = service === "github" ? "GitHub Connected" : "Connection Successful";
        const msg = service === "github" && data?.integrations?.github_details 
          ? `Successfully authenticated as ${data.integrations.github_details}` 
          : `Successfully connected top-level ${service.toUpperCase()} account`;
          
        setSuccessToast({ show: true, title, message: msg });
        setTimeout(() => setSuccessToast(prev => ({ ...prev, show: false })), 4000);
      }
      setActiveModal(null);
      // Reset inputs
      setGithubPat("");
      setAwsAccessKey("");
      setAwsSecretKey("");
      setAzureSecret("");
      setGithubEmail("");
      setGithubToken("");
    } catch (err: any) {
      alert(err.message || "Failed to update integration connection");
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
            <div className="flex flex-col items-end">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
              }`}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
              {isConnected && key === "github" && githubDetails && (
                <span className="text-[10px] text-slate-400 mt-1 font-mono">{githubDetails}</span>
              )}
            </div>
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
          {isConnected ? `Disconnect Account` : "Connect Account"}
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans pb-10 relative">
        
        {/* Success Toast */}
        <div className={`fixed top-6 right-6 z-50 transition-all duration-300 transform ${successToast.show ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}>
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl shadow-lg flex items-center gap-3 backdrop-blur-md">
            <CheckCircle size={20} />
            <div>
              <h4 className="font-bold text-sm">{successToast.title}</h4>
              <p className="text-xs text-emerald-400/80">{successToast.message}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white">Central Connections & Integrations</h2>
            <p className="text-sm text-slate-500 mt-1">
              Authenticate your cloud providers to unlock dynamic log streaming and autonomous event analysis.
            </p>
          </div>
          {(status.aws || status.azure) && (
            <Link href="/" className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
              Manage Cloud Resources <ArrowRight size={16} />
            </Link>
          )}
        </div>

        <h3 className="text-sm font-semibold text-slate-300 mt-4 border-b border-slate-800 pb-2">Version Control</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderCard("github", "GitHub Integration", "Connect your source repositories to automatically log releases and capture workflow runs.", GitBranch, "text-indigo-400", "bg-indigo-400/10", "github")}
        </div>

        <h3 className="text-sm font-semibold text-slate-300 mt-6 border-b border-slate-800 pb-2">Cloud Infrastructure</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {renderCard("aws", "Amazon Web Services", "Connect your AWS account via Access Keys to dynamically fetch and monitor resources like EC2, S3, and EKS.", Server, "text-amber-400", "bg-amber-400/10", "aws")}
          {renderCard("azure", "Microsoft Azure", "Connect your Azure tenant via Service Principal to monitor VMs, AKS, and App Services.", Database, "text-sky-400", "bg-sky-400/10", "azure")}
        </div>

        {/* GitHub Modal */}
        {activeModal === "github" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <GitBranch className="text-indigo-400" /> Connect GitHub
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide your GitHub repository details and a Personal Access Token (PAT) to authorize workflow and deployment synchronization.
              </p>
              <div className="space-y-4 mt-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    GitHub Email
                  </label>
                  <input
                    type="email"
                    value={githubEmail}
                    onChange={(e) => setGithubEmail(e.target.value)}
                    placeholder="e.g. user@example.com"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-2">
                    <strong className="text-slate-400">Note:</strong> When creating a Classic PAT, select the <code className="bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded">repo</code>, <code className="bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded">workflow</code>, and <code className="bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded">user:email</code> scopes so Nexus AI can verify your account and run pipelines. Do not select unnecessary scopes.
                  </p>
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
                  onClick={() => {
                    handleToggleConnect("github", true, { 
                      github_token: githubToken, 
                      github_email: githubEmail 
                    });
                  }}
                  disabled={!githubEmail || !githubToken}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Verify & Connect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AWS Modal */}
        {activeModal === "aws" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="text-amber-400" /> Connect AWS Account
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide AWS Access Keys to allow Nexus AI to dynamically fetch your EC2, EKS, and S3 resources and read CloudWatch logs.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Access Key ID</label>
                  <input
                    type="text"
                    value={awsAccessKey}
                    onChange={(e) => setAwsAccessKey(e.target.value)}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Secret Access Key</label>
                  <input
                    type="password"
                    value={awsSecretKey}
                    onChange={(e) => setAwsSecretKey(e.target.value)}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Default Region</label>
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
                  onClick={() => handleToggleConnect("aws", true, { access_key_id: awsAccessKey, secret_access_key: awsSecretKey, region: awsRegion })}
                  disabled={!awsAccessKey || !awsSecretKey}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Authenticate AWS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Azure Modal */}
        {activeModal === "azure" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden relative shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="text-sky-400" /> Connect Azure Tenant
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide Service Principal access credentials to authorize Nexus AI to fetch VMs and Azure Monitor logs.
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
                  <div className="relative">
                    <input
                      type={showAzureSecret ? "text" : "password"}
                      value={azureSecret}
                      onChange={(e) => setAzureSecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-[#0a0a0f] border border-slate-800 text-slate-200 rounded-lg p-2.5 pr-10 text-xs font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAzureSecret(!showAzureSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showAzureSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
                  onClick={() => handleToggleConnect("azure", true, { client_id: azureClient, client_secret: azureSecret, tenant_id: azureTenant })}
                  disabled={!azureTenant || !azureClient || !azureSecret}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Authenticate Azure
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
