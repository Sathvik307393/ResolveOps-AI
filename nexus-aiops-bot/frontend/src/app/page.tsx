"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchApi } from "@/lib/api";
import { Cloud, Server, Database, Activity, RefreshCw, GitBranch, Box, Settings, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CloudResourcesDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<any>({});
  const [stats, setStats] = useState<{aws: number, azure: number}>({aws: 0, azure: 0});

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetchApi("/api/v1/integrations").catch(() => ({})),
      fetchApi("/api/v1/cloud/resources").catch(() => [])
    ]).then(([integData, resData]) => {
      setIntegrations(integData);
      
      const awsCount = Array.isArray(resData) ? resData.filter(r => r.provider === "AWS").length : 0;
      const azureCount = Array.isArray(resData) ? resData.filter(r => r.provider === "Azure").length : 0;
      setStats({ aws: awsCount, azure: azureCount });
      
      setLoading(false);
    });
  };

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <Activity className="animate-spin text-indigo-500 w-8 h-8" />
        </div>
      </DashboardLayout>
    );
  }

  const isAwsConnected = integrations.aws?.connected;
  const isAzureConnected = integrations.azure?.connected;
  const isGithubConnected = integrations.github?.connected;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full font-sans pb-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Global Platform Overview</h1>
            <p className="text-sm text-slate-400">
              High-level status of your connected cloud environments and developer toolchains.
            </p>
          </div>
          <button 
            onClick={fetchData}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors border border-slate-700"
          >
            <RefreshCw size={16} /> Refresh Status
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Azure Card */}
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group hover:border-sky-500/50 transition-all cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-sky-500/20"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20">
                <Cloud size={28} />
              </div>
              {isAzureConnected ? (
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/20">Connected</span>
              ) : (
                <span className="px-2.5 py-1 bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-slate-700">Not Configured</span>
              )}
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Microsoft Azure</h2>
            
            {isAzureConnected ? (
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-6">Actively monitoring Azure subscriptions and resource groups.</p>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-4xl font-black text-white">{stats.azure}</span>
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Resources Discovered</span>
                </div>
                <Link href="/azure" className="w-full flex justify-center items-center gap-2 py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl font-semibold transition-colors border border-sky-500/20 group-hover:bg-sky-500 group-hover:text-white">
                  Enter Azure Hub <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-end">
                <p className="text-sm text-slate-500 mb-6">Connect your Azure account to monitor infrastructure.</p>
                <Link href="/integrations" className="w-full flex justify-center items-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors border border-slate-700">
                  <Settings size={16} /> Configure
                </Link>
              </div>
            )}
          </div>

          {/* AWS Card */}
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group hover:border-amber-500/50 transition-all cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-amber-500/20"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <Box size={28} />
              </div>
              {isAwsConnected ? (
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/20">Connected</span>
              ) : (
                <span className="px-2.5 py-1 bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-slate-700">Not Configured</span>
              )}
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Amazon Web Services</h2>
            
            {isAwsConnected ? (
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-6">Actively monitoring EC2, EKS, and S3 resources.</p>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-4xl font-black text-white">{stats.aws}</span>
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Resources Discovered</span>
                </div>
                <button disabled className="w-full flex justify-center items-center gap-2 py-3 bg-slate-800 text-slate-500 rounded-xl font-semibold border border-slate-700 cursor-not-allowed">
                  AWS Hub (Coming Soon)
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-end">
                <p className="text-sm text-slate-500 mb-6">Connect your AWS account to monitor infrastructure.</p>
                <Link href="/integrations" className="w-full flex justify-center items-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors border border-slate-700">
                  <Settings size={16} /> Configure
                </Link>
              </div>
            )}
          </div>

          {/* GitHub Card */}
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group hover:border-purple-500/50 transition-all cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-purple-500/20"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
                <GitBranch size={28} />
              </div>
              {isGithubConnected ? (
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/20">Connected</span>
              ) : (
                <span className="px-2.5 py-1 bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-slate-700">Not Configured</span>
              )}
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">GitHub Actions</h2>
            
            {isGithubConnected ? (
              <div className="flex-1 flex flex-col justify-end">
                <p className="text-sm text-slate-400 mb-6">Actively synchronizing CI/CD pipeline telemetry.</p>
                <Link href="/github" className="w-full flex justify-center items-center gap-2 py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-xl font-semibold transition-colors border border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white">
                  Enter GitHub Sync <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-end">
                <p className="text-sm text-slate-500 mb-6">Connect GitHub to monitor CI/CD pipelines.</p>
                <Link href="/integrations" className="w-full flex justify-center items-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors border border-slate-700">
                  <Settings size={16} /> Configure
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
