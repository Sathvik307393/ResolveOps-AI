"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ArrowLeft, Server, AlertTriangle, Activity, Database, DollarSign, Layers, RefreshCw, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import ResourceRiskSummaryCards from "@/components/resource-intelligence/ResourceRiskSummaryCards";
import ResourceRiskList from "@/components/resource-intelligence/ResourceRiskList";

export default function AwsResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = decodeURIComponent(params.id);
  
  const [resource, setResource] = useState(null);
  const [cost, setCost] = useState(null);
  const [risks, setRisks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsStatus, setLogsStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [subresources, setSubresources] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchResourceData();
  }, [resourceId]);

  const fetchResourceData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const resData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}`).catch(() => null);
      if (resData) setResource(resData);
      
      const costData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/cost`).catch(() => null);
      if (costData) setCost(costData);

      const risksData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/risks`).catch(() => []);
      if (risksData) setRisks(risksData.risks || []);

      const logsData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/logs`).catch(() => null);
      if (logsData) {
        setLogs(logsData.logs || []);
        setLogsStatus({
            available: logsData.logs_available,
            message: logsData.message,
            warnings: logsData.warnings || []
        });
      }

      const metricsData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/metrics`).catch(() => null);
      if (metricsData) setMetrics(metricsData.metrics || null);

      const eventsData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/events`).catch(() => []);
      if (eventsData) setEvents(eventsData.events || []);

      const relsData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/relationships`).catch(() => []);
      if (relsData) setRelationships(relsData.relationships || []);

      const subData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/subresources`).catch(() => null);
      if (subData) setSubresources(subData);

      if (resData?.resource_type?.includes("EC2")) {
          const runData = await fetchApi(`/api/v1/aws/resources/${encodeURIComponent(resourceId)}/runtime`).catch(() => null);
          if (runData) setRuntime(runData);
      }


    } catch (err) {
      console.error("Failed to load resource data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCopyArn = () => {
    if (resource?.arn) {
      navigator.clipboard.writeText(resource.arn);
      alert("ARN copied to clipboard");
    }
  };

  const getAwsConsoleUrl = () => {
    if (!resource) return "#";
    const region = resource.region || "us-east-1";
    if (resource.resource_type?.includes("EC2")) {
        return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#InstanceDetails:instanceId=${resource.id}`;
    }
    if (resource.resource_type?.includes("SecurityGroup")) {
        return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#SecurityGroup:groupId=${resource.id}`;
    }
    return `https://console.aws.amazon.com/`;
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
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-200 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Inventory
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyArn}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
              title="Copy ARN"
            >
              <Copy className="w-4 h-4" /> <span className="hidden sm:inline">Copy ARN</span>
            </button>
            <a
              href={getAwsConsoleUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
              title="Open in AWS Console"
            >
              <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">AWS Console</span>
            </a>
            <button
              onClick={() => fetchResourceData(true)}
              disabled={refreshing}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 transition-colors border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> 
              <span className="hidden sm:inline">{refreshing ? "Syncing..." : "Refresh"}</span>
            </button>
            <button 
              onClick={generateRca}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors ml-2"
            >
              Generate AI RCA
            </button>
          </div>
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

        <AwsResourceMetadataGrid resource={resource} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Intelligence UI Components */}
            <ResourceRiskSummaryCards risks={risks} />
            
            <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Risk Analysis</h3>
              <ResourceRiskList risks={risks} />
            </div>

            <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                 <Activity className="w-5 h-5 text-blue-400" /> Recent Logs & Events
              </h3>
              <AwsResourceLogsAndEvents logs={logs} logsStatus={logsStatus} metrics={metrics} events={events} resource={resource} />
            </div>
          </div>

          <div className="space-y-8">
            {/* Cost Intelligence */}
            <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" /> Cost Intelligence
              </h3>
              {cost?.cost_status === "unavailable" ? (
                <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Resource-level cost unavailable</p>
                      <p className="text-sm text-slate-400 mt-1">{cost.reason || "Cost Explorer permissions or resource-level tags are not configured."}</p>
                    </div>
                  </div>
                </div>
              ) : cost ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">Month-to-Date (Actual)</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {cost.actual_cost?.status === "available" ? `$${cost.actual_cost.month_to_date}` : "Unavailable"}
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
                  Loading cost intelligence...
                </div>
              )}
            </div>

            {/* Relationship Context */}
            <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" /> Relationship Context
              </h3>
              {relationships && relationships.length > 0 ? (
                <div className="space-y-3">
                  {relationships.map((rel, i) => (
                    <div key={i} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{rel.type}</span>
                      <div className="text-sm font-mono text-slate-300 mt-1 truncate" title={rel.id}>{rel.id}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">No direct relationships found.</div>
              )}
              <p className="text-xs text-slate-500 mt-4 italic border-t border-slate-700/50 pt-4">More relationships available in Architecture Diagram.</p>
            </div>
            
            {/* Sub-Resources */}
            {subresources && (
              <AwsSubResources subresources={subresources} resource={resource} />
            )}

            {/* Runtime Workloads */}
            {runtime && (
              <AwsRuntime runtime={runtime} />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function AwsResourceMetadataGrid({ resource }) {
  if (!resource || !resource.metadata) return null;
  const meta = resource.metadata;
  const isEC2 = resource.resource_type?.includes("EC2");
  const isSG = resource.resource_type?.includes("SecurityGroup");
  const isVolume = resource.resource_type?.includes("Volume");

  const renderField = (label, value) => {
    if (value === undefined || value === null || value === "") return null;
    return (
      <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/30">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm text-slate-200 font-mono break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
      </div>
    );
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
      <h3 className="text-lg font-bold text-slate-100 mb-4">Resource Metadata</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {isEC2 && (
          <>
            {renderField("Instance Type", meta.instance_type)}
            {renderField("Public IP", meta.public_ip)}
            {renderField("Private IP", meta.private_ip)}
            {renderField("VPC ID", meta.vpc_id)}
            {renderField("Subnet ID", meta.subnet_id)}
            {renderField("Availability Zone", meta.availability_zone)}
            {renderField("AMI ID", meta.ami_id)}
            {renderField("Key Pair", meta.key_name)}
            {renderField("Launch Time", meta.launch_time)}
          </>
        )}
        {isSG && (
          <>
            {renderField("VPC ID", meta.vpc_id)}
            {renderField("Group Name", meta.group_name)}
            {renderField("Description", meta.description)}
          </>
        )}
        {isVolume && (
          <>
            {renderField("Size (GB)", meta.size)}
            {renderField("Volume Type", meta.volume_type)}
            {renderField("IOPS", meta.iops)}
            {renderField("Throughput", meta.throughput)}
            {renderField("Encrypted", meta.encrypted)}
            {renderField("Availability Zone", meta.availability_zone)}
            {renderField("Creation Time", meta.create_time)}
          </>
        )}
        {!isEC2 && !isSG && !isVolume && (
          <>
            {Object.entries(meta).map(([key, val]) => renderField(key.replace(/_/g, ' '), val))}
          </>
        )}
      </div>
    </div>
  );
}

function AwsResourceLogsAndEvents({ logs, logsStatus, metrics, events, resource }) {
  return (
    <div className="space-y-6">
      {/* Metrics Snapshot */}
      {metrics && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">Metrics Snapshot</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(metrics).slice(0, 4).map(([k, v], i) => (
              <div key={i} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 text-center">
                <p className="text-xs text-slate-400 mb-1 truncate" title={k}>{k}</p>
                <p className="text-lg font-bold text-slate-200">{typeof v === 'number' ? v.toFixed(2) : v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Collection Status & Logs */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">Log Collection</h4>
        {logsStatus && logsStatus.available === false ? (
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-200">{logsStatus.message || "Logs unavailable."}</p>
                {logsStatus.warnings && logsStatus.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {logsStatus.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-slate-400">• {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-green-400 max-h-64 overflow-y-auto whitespace-pre-wrap border border-slate-800">
            {logs.map((l, i) => (
              <div key={i} className="mb-2">
                <span className="text-slate-500 mr-2">{l.timestamp || l.time || ""}</span>
                <span>{l.message || l.msg || JSON.stringify(l)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-800/30 text-slate-400 text-sm text-center border border-slate-700/30 rounded-lg">
            No recent logs found.
          </div>
        )}
      </div>

      {/* Events */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">Recent Events</h4>
        {events && events.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {events.map((ev, i) => (
              <div key={i} className="p-2 bg-slate-800/40 border border-slate-700/40 rounded text-xs">
                <span className="text-indigo-400 font-bold mr-2">{ev.eventName || ev.type}</span>
                <span className="text-slate-300">{ev.eventTime || ev.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-slate-800/30 text-slate-400 text-sm text-center border border-slate-700/30 rounded-lg">
            No recent events recorded.
          </div>
        )}
      </div>
    </div>
  );
}

function AwsSubResources({ subresources, resource }) {
  if (!subresources || Object.keys(subresources).length === 0) return null;
  
  const hasWarnings = subresources.status === "partial_success" && subresources.warnings && subresources.warnings.length > 0;

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
      <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Layers className="w-5 h-5 text-indigo-400" /> Sub-Resources & Child Components
      </h3>
      
      {hasWarnings && (
        <div className="mb-4 p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-200">Sub-resource discovery partially available</p>
              <ul className="mt-1 space-y-1">
                {subresources.warnings.map((w, i) => <li key={i} className="text-xs text-slate-400">• {w}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(subresources.subresources || {}).map(([key, val]) => {
          if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'object' && Object.keys(val).length === 0)) return null;
          
          return (
            <div key={key} className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
              <h4 className="text-sm font-semibold text-slate-300 capitalize mb-3 border-b border-slate-700 pb-2">
                {key.replace(/_/g, ' ')}
              </h4>
              
              {Array.isArray(val) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {val.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/50 border border-slate-700 rounded-md text-xs">
                      {typeof item === 'object' ? (
                        Object.entries(item).map(([k, v]) => (
                           <div key={k} className="flex justify-between mb-1 last:mb-0">
                             <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                             <span className="text-slate-300 font-mono text-right truncate max-w-[120px]" title={String(v)}>{String(v)}</span>
                           </div>
                        ))
                      ) : (
                        <span className="text-slate-300 font-mono">{item}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-md text-xs text-slate-300 font-mono">
                  {JSON.stringify(val, null, 2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwsRuntime({ runtime }) {
  if (!runtime) return null;
  
  const isError = runtime.status === "error" || runtime.status === "permission_required";
  const hasContainers = runtime.runtime?.containers && runtime.runtime.containers.length > 0;

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-700/50">
      <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Server className="w-5 h-5 text-fuchsia-400" /> Runtime & Containers
      </h3>
      
      {isError ? (
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-200">Runtime discovery unavailable</p>
              <p className="text-sm text-slate-400 mt-1">{runtime.message || "Runtime discovery requires AWS Systems Manager or a ResolveOps agent."}</p>
            </div>
          </div>
        </div>
      ) : hasContainers ? (
        <div className="space-y-3">
          {runtime.runtime.containers.map((c, i) => (
            <div key={i} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg flex flex-wrap gap-4 items-center justify-between text-sm">
               <div className="flex flex-col">
                  <span className="text-slate-500 text-xs">Container Name</span>
                  <span className="text-slate-200 font-bold">{c.name}</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-slate-500 text-xs">Image</span>
                  <span className="text-slate-300 font-mono">{c.image}</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-slate-500 text-xs">Status</span>
                  <span className="text-emerald-400">{c.status}</span>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-sm">
          {runtime.message || "No runtime containers discovered."}
        </div>
      )}
    </div>
  );
}
