import os

file_path = r'frontend\src\app\page.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace fetch calls
replace_target1 = """    Promise.all([
      fetchApi("/api/v1/integrations").catch(() => ({})),
      fetchApi("/api/v1/cloud/resources").catch(() => []),
      fetchApi("/api/v1/github/deployments").catch(() => [])
    ]).then(([integData, resData, depData]) => {"""

replace_with1 = """    Promise.all([
      fetchApi("/api/v1/integrations").catch(() => ({})),
      fetchApi("/api/v1/cloud/resources").catch(() => []),
      fetchApi("/api/v1/github/deployments").catch(() => []),
      fetchApi("/api/v1/cloud/azure/cost").catch(() => ({}))
    ]).then(([integData, resData, depData, costData]) => {"""

content = content.replace(replace_target1, replace_with1)

# Replace stats object cost
replace_target2 = """        risks: 0,     // In reality, fetch from a risks API
        cost: "$0.00", // In reality, fetch from billing API"""

replace_with2 = """        risks: 0,     // In reality, fetch from a risks API
        cost: costData && !costData.error ? costData : null,"""

content = content.replace(replace_target2, replace_with2)

# Replace StatCard with CostCard
replace_target3 = """          <StatCard title="Est. Cloud Cost" value={stats.cost} icon={<DollarSign />} color="slate" />"""

replace_with3 = """          <CostCard costData={stats.cost} />"""

content = content.replace(replace_target3, replace_with3)

# Add CostCard component at the end
cost_card_code = """
function CostCard({ costData }) {
  if (!costData || !costData.subscription_cost) {
    return (
      <div className="glass-panel border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 rounded-lg text-slate-400 bg-slate-500/10 border-slate-500/20 border">
            <DollarSign />
          </div>
        </div>
        <div>
          <p className="text-3xl font-black text-white mb-1 tracking-tight">$0.00</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Est. Cloud Cost</p>
        </div>
      </div>
    );
  }

  const sub = costData.subscription_cost;
  const isPermissionReq = sub.status === "permission_required";
  
  return (
    <div className="glass-panel border border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.1)] rounded-2xl p-4 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <div className="p-2 rounded-lg text-sky-400 bg-sky-500/10 border border-sky-500/20">
          <DollarSign size={20} />
        </div>
        {isPermissionReq ? (
          <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert size={10} /> Permission Required
          </span>
        ) : (
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle size={10} /> Actual
          </span>
        )}
      </div>
      <div>
        {isPermissionReq ? (
          <p className="text-sm font-bold text-slate-400 mb-1 leading-tight">Unavailable</p>
        ) : (
          <p className="text-2xl font-black text-white mb-1 tracking-tight">
            {sub.currency_symbol}{sub.month_to_date_actual.toLocaleString()}
          </p>
        )}
        <div className="flex justify-between items-end">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Month-to-Date</p>
          <p className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded uppercase">{sub.currency}</p>
        </div>
      </div>
    </div>
  );
}
"""
content = content + cost_card_code

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("page.jsx patched")
