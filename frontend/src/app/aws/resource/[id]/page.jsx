"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { ArrowLeft, Server, AlertTriangle, Activity, Database, DollarSign, Layers } from "lucide-react";
import ResourceRiskSummaryCards from "@/components/resource-intelligence/ResourceRiskSummaryCards";
import ResourceRiskList from "@/components/resource-intelligence/ResourceRiskList";
import ResourceLogPreview from "@/components/resource-intelligence/ResourceLogPreview";

export default function AwsResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = decodeURIComponent(params.id);
  
  const [resource, setResource] = useState(null);
  const [cost, setCost] = useState(null);
  const [risks, setRisks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResourceData();
  }, [resourceId]);

  const fetchResourceData = async () => {
    setLoading(true);
    try {
      // In full implementation, these hit the API Gateway -> aws-intelligence-service
      const resData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}`).catch(() => null);
      if (resData) setResource(resData);
      
      const costData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/cost`).catch(() => null);
      if (costData) setCost(costData);

      const risksData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/risks`).catch(() => []);
      if (risksData) setRisks(risksData.risks || []);

      const logsData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/logs`).catch(() => []);
      if (logsData) setLogs(logsData.logs || []);

    } catch (err) {
      console.error("Failed to load resource data", err);
    } finally {
      setLoading(false);
    }
  };

  const generateRca = async () => {
    // RCA trigger logic
    alert("Generating AI RCA via Amazon Bedrock...");
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-400">Loading AWS Resource Details...</p>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-200 flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </button>
        <div className="glass-panel p-12 text-center rounded-xl border border-rose-500/30">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100">Resource Not Found</h2>
          <p className="text-slate-400 mt-2">The specified AWS resource could not be found or you lack permissions to view it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-200 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </button>
        
        <button 
          onClick={generateRca}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          Generate AI RCA
        </button>
      </div>

      {/* Resource Summary Header */}
      <div className="glass-panel p-6 rounded-xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
            {resource.resource_type?.includes("EC2") ? <Server className="w-8 h-8 text-blue-400" /> :
             resource.resource_type?.includes("RDS") ? <Database className="w-8 h-8 text-indigo-400" /> :
             resource.resource_type?.includes("EKS") ? <Layers className="w-8 h-8 text-purple-400" /> :
             <Activity className="w-8 h-8 text-amber-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{resource.resource_name || resource.id}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-400 font-mono">
              <span>{resource.resource_type}</span>
              <span>•</span>
              <span>{resource.region}</span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                resource.status === 'running' || resource.status === 'available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {resource.status}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2 font-mono truncate max-w-2xl">{resource.arn}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Intelligence UI Components */}
          <ResourceRiskSummaryCards risks={risks} />
          
          <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Risk Analysis</h3>
            <ResourceRiskList risks={risks} />
          </div>

          <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Recent Logs & Events</h3>
            <ResourceLogPreview logs={logs} />
          </div>
        </div>

        <div className="space-y-8">
          {/* Cost Intelligence */}
          <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Cost Intelligence
            </h3>
            {cost ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-400">Month-to-Date (Actual)</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {cost.actual_cost?.status === "available" ? `$${cost.actual_cost.month_to_date}` : "Permission Required"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Source: {cost.actual_cost?.source}</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-400">Estimated Running Price (Monthly)</p>
                  <p className="text-xl font-bold text-slate-200">
                    {cost.estimated_running_price?.status === "available" ? `$${cost.estimated_running_price.monthly}` : "Unavailable"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Confidence: {cost.estimated_running_price?.confidence}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
                Cost data is currently unavailable.
              </div>
            )}
          </div>

          {/* Relationship Context */}
          <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Relationship Context</h3>
            {resource.metadata?.vpc_id && (
              <div className="mb-3">
                <span className="text-xs text-slate-500 block">VPC</span>
                <span className="text-sm text-slate-300 font-mono">{resource.metadata.vpc_id}</span>
              </div>
            )}
            {resource.metadata?.subnet_id && (
              <div className="mb-3">
                <span className="text-xs text-slate-500 block">Subnet</span>
                <span className="text-sm text-slate-300 font-mono">{resource.metadata.subnet_id}</span>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-4 italic">More relationships available in Architecture Diagram.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
