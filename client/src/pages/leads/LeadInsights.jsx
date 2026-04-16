import { useState, useEffect, useMemo } from "react";
import {
  ArrowPathIcon,
  ChartBarIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  GlobeAltIcon,
  TrophyIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner.jsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const LeadInsights = () => {
  const [allLeads, setAllLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*, users!leads_created_by_fkey(full_name, profiles(branch_id, region_id))");

      if (error) throw error;

      const { data: custs } = await supabase
        .from("customers")
        .select("lead_id, created_at")
        .not("lead_id", "is", null);

      const convMap = new Map((custs || []).map((c) => [c.lead_id, c.created_at]));

      setAllLeads(
        (data || []).map((l) => ({
          ...l,
          is_converted: convMap.has(l.id),
          converted_at: convMap.get(l.id),
          created_by_name: l.users?.full_name || "—",
        }))
      );
    } catch {
      showToast("Failed to load analytics data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchLeads();
  }, [profile]);

  // ── Metrics & Aggregations ────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = allLeads.length;
    const converted = allLeads.filter((l) => l.is_converted);
    const conversionRate = total > 0 ? ((converted.length / total) * 100).toFixed(1) : 0;

    // Conversion Velocity (Avg days)
    const velocityData = converted.filter(l => l.converted_at && l.created_at);
    const avgVelocity = velocityData.length > 0 
      ? (velocityData.reduce((acc, l) => {
          const diff = new Date(l.converted_at) - new Date(l.created_at);
          return acc + (diff / (1000 * 60 * 60 * 24));
        }, 0) / velocityData.length).toFixed(1)
      : "—";

    return { total, conversionRate, avgVelocity };
  }, [allLeads]);

  const funnelData = useMemo(() => {
    const counts = { Cold: 0, Warm: 0, Hot: 0, Converted: 0 };
    allLeads.forEach(l => {
      if (l.is_converted) counts.Converted++;
      else counts[l.status]++;
    });
    return [
      { name: "Cold", value: counts.Cold + counts.Warm + counts.Hot + counts.Converted, fill: "#2E5E99" }, // brand-primary (Blue)
      { name: "Warm", value: counts.Warm + counts.Hot + counts.Converted, fill: "#FACC15" }, // highlight (Yellow/Gold)
      { name: "Hot", value: counts.Hot + counts.Converted, fill: "#F97316" }, // Orange
      { name: "Converted", value: counts.Converted, fill: "#10B981" }, // accent (Green)
    ];
  }, [allLeads]);

  const sourceData = useMemo(() => {
    const map = {};
    allLeads.forEach(l => {
      const s = l.source || "Walk-in";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [allLeads]);

  const industryData = useMemo(() => {
    const map = {};
    allLeads.forEach(l => {
      const i = l.industry || "Uncategorized";
      map[i] = (map[i] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allLeads]);

  const roRanking = useMemo(() => {
    const map = {};
    allLeads.forEach(l => {
      const ro = l.created_by_name;
      if (!map[ro]) map[ro] = { name: ro, total: 0, converted: 0 };
      map[ro].total++;
      if (l.is_converted) map[ro].converted++;
    });
    return Object.values(map)
      .map(d => ({ ...d, rate: Number(((d.converted / d.total) * 100).toFixed(1)) }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [allLeads]);

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="bg-muted p-6 min-h-screen font-body">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm text-slate-600">Leads Insights</h1>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <InsightCard label="Total Leads" value={metrics.total} icon={UsersIcon} color="primary" />
        <InsightCard label="Conv. Rate" value={`${metrics.conversionRate}%`} icon={CheckCircleIcon} color="accent" />
        <InsightCard label="Avg. Conv. Time" value={`${metrics.avgVelocity} Days`} icon={ClockIcon} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ── Conversion Funnel ── */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <FunnelIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm ">Pipeline Funnel</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                   {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── RO Leaderboard ── */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrophyIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm ">Top Officers (Conv. Rate)</h3>
          </div>
          <div className="space-y-4">
            {roRanking.map((ro, i) => (
              <div key={ro.name} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-surface flex items-center justify-center font-bold text-brand-primary text-xs">
                  #{i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-text">{ro.name}</span>
                    <span className="text-sm font-black text-brand-primary">{ro.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-brand-surface rounded-full overflow-hidden">
                    <div className="bg-brand-primary h-full rounded-full transition-all duration-1000" style={{ width: `${ro.rate}%` }} />
                  </div>
                  <div className="text-[10px] text-muted mt-1 uppercase tracking-tight font-semibold">{ro.converted} converted / {ro.total} total</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Lead Sources ── */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <GlobeAltIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm">Source Distribution</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {sourceData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: "600" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Industry Distribution ── */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <GlobeAltIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm ">Industry Distribution</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={25}>
                  {industryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Status Aging Heatmap (Simplified) ── */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <ClockIcon className="h-5 w-5 text-brand-primary" />
            <h3 className="font-semibold text-gray-600  text-sm ">Aging Tiers (Counts)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "0-7 Days", color: "bg-accent" },
              { label: "8-14 Days", color: "bg-brand-secondary" },
              { label: "15-30 Days", color: "bg-highlight" },
              { label: "30+ Days", color: "bg-red-500" }
            ].map(tier => (
              <div key={tier.label} className="p-4 rounded-2xl bg-brand-surface border border-indigo-50">
                <div className={`w-2 h-2 rounded-full ${tier.color} mb-2`}></div>
                <div className="text-xs  text-slate-600  ">{tier.label}</div>
                <div className="text-xl font-semibold text-slate-600 ">
                  {allLeads.filter(l => {
                    if (l.is_converted) return false;
                    const days = (new Date() - new Date(l.created_at)) / (1000 * 60 * 60 * 24);
                    if (tier.label === "0-7 Days") return days <= 7;
                    if (tier.label === "8-14 Days") return days > 7 && days <= 14;
                    if (tier.label === "15-30 Days") return days > 14 && days <= 30;
                    return days > 30;
                  }).length}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

const InsightCard = ({ label, value, icon: Icon, color }) => {
  const colors = {
    primary: "bg-brand-surface text-brand-primary",
    accent: "bg-emerald-50 text-accent",
    brand: "bg-indigo-50 text-brand-btn",
  };
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm text-slate-600 mb-1 font-body">{label}</p>
        <h3 className="text-2xl  text-slate-600 font-semibold">{value}</h3>
      </div>
    </div>
  );
};

export default LeadInsights;
