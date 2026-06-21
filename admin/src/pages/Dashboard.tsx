import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api.js';

interface DashboardData {
  metrics: { totalUsers: number; totalListings: number; pendingListings: number; activeListings: number; rejectedListings: number; totalReports: number; totalFavorites: number; totalMessages: number };
  recentListings: Array<{ id: string; brand: string; model: string; price: number; status: string; createdAt: string }>;
  recentActivity: Array<{ type: string; description: string; createdAt: string }>;
}

const statusColors = ['#22c55e', '#f59e0b', '#ef4444'];

export function Dashboard() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: async () => (await api.get<DashboardData>('/admin/dashboard')).data, staleTime: 30_000 });
  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"><p className="font-medium">Dashboard data could not be loaded.</p><button type="button" className="mt-3 min-h-10 rounded-md bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800" onClick={() => refetch()}>Retry</button></div>;

  const { metrics } = data;
  const statusData = [{ name: 'Active', value: metrics.activeListings }, { name: 'Pending', value: metrics.pendingListings }, { name: 'Rejected', value: metrics.rejectedListings }];
  const reviewed = metrics.activeListings + metrics.rejectedListings;
  const reviewRate = metrics.totalListings ? Math.round((reviewed / metrics.totalListings) * 100) : 0;

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Operations overview</p><h1 className="mt-1 text-3xl font-semibold text-slate-950">Moderation workspace</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prioritize listings and reports that need a decision, while keeping marketplace health visible.</p></div>
      <div className="flex items-center gap-3"><span className="text-xs text-slate-500">Updates every 30 seconds</span><button type="button" onClick={() => refetch()} disabled={isFetching} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">{isFetching ? 'Refreshing...' : 'Refresh data'}</button></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Needs review" value={metrics.pendingListings} detail="Pending listings" tone="amber" href="/listings" />
      <MetricCard label="Open reports" value={metrics.totalReports} detail="Safety and policy queue" tone="red" href="/reports" />
      <MetricCard label="Live inventory" value={metrics.activeListings} detail={`${metrics.totalListings.toLocaleString()} total listings`} tone="green" href="/listings" />
      <MetricCard label="Active members" value={metrics.totalUsers} detail={`${metrics.totalMessages.toLocaleString()} messages`} tone="slate" href="/users" />
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
      <Panel title="Listing decisions" subtitle="Current inventory by moderation status"><div className="h-[270px]" aria-label="Bar chart showing listings by status"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} /><Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, borderColor: '#cbd5e1', boxShadow: '0 8px 20px rgba(15, 23, 42, .12)' }} /><Bar dataKey="value" radius={[5, 5, 0, 0]}>{statusData.map((entry, index) => <Cell key={entry.name} fill={statusColors[index]} />)}</Bar></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="Marketplace health" subtitle="Moderation completion"><div className="flex items-center gap-4"><div className="h-36 w-36 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" innerRadius={43} outerRadius={61} paddingAngle={3} stroke="none">{statusData.map((entry, index) => <Cell key={entry.name} fill={statusColors[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="min-w-0 space-y-3"><p className="text-3xl font-semibold tabular-nums text-slate-950">{reviewRate}%</p><p className="text-sm text-slate-600">of listings have received a moderation decision.</p>{statusData.map((item, index) => <div key={item.name} className="flex items-center justify-between gap-4 text-xs"><span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[index] }} />{item.name}</span><span className="font-semibold tabular-nums text-slate-800">{item.value.toLocaleString()}</span></div>)}</div></div></Panel>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
      <Panel title="Latest listings" subtitle="Most recently submitted marketplace items" action={<Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" to="/listings">Open listings</Link>}><div className="overflow-x-auto"><table className="admin-table min-w-[620px]"><thead><tr><th>Listing</th><th>Price</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{data.recentListings.length ? data.recentListings.map((listing) => <tr key={listing.id}><td><p className="font-medium text-slate-900">{listing.brand} {listing.model}</p><p className="text-xs text-slate-500">Listing #{listing.id}</p></td><td className="font-medium tabular-nums text-slate-900">${Number(listing.price).toLocaleString()}</td><td><StatusBadge status={listing.status} /></td><td className="whitespace-nowrap text-slate-500">{new Date(listing.createdAt).toLocaleDateString()}</td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-sm text-slate-500">No recent listings</td></tr>}</tbody></table></div></Panel>
      <Panel title="Recent activity" subtitle="Latest operator and marketplace events" action={<Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" to="/activity">View log</Link>}><div className="divide-y divide-slate-100">{data.recentActivity.length ? data.recentActivity.map((activity, index) => <div key={`${activity.createdAt}-${index}`} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-slate-300" /><div className="min-w-0"><p className="text-sm font-medium capitalize text-slate-900">{activity.type}</p><p className="mt-0.5 truncate text-sm text-slate-600">{activity.description}</p><p className="mt-1 text-xs text-slate-400">{new Date(activity.createdAt).toLocaleString()}</p></div></div>) : <p className="py-10 text-center text-sm text-slate-500">No recent activity</p>}</div></Panel>
    </section>
  </div>;
}

function MetricCard({ label, value, detail, tone, href }: { label: string; value: number; detail: string; tone: 'amber' | 'red' | 'green' | 'slate'; href: string }) { const tones = { amber: 'border-amber-200 bg-amber-50/70 text-amber-800', red: 'border-red-200 bg-red-50/70 text-red-800', green: 'border-emerald-200 bg-emerald-50/70 text-emerald-800', slate: 'border-slate-200 bg-white text-slate-800' }; return <Link to={href} className={`group rounded-lg border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tones[tone]}`}><p className="text-sm font-medium">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{value.toLocaleString()}</p><p className="mt-2 text-xs text-slate-600">{detail}<span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span></p></Link>; }
function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="admin-surface overflow-hidden"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-0.5 text-sm text-slate-500">{subtitle}</p></div>{action}</header><div className="p-5">{children}</div></section>; }
function StatusBadge({ status }: { status: string }) { const styles: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', active: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-100 text-red-800' }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>; }
function DashboardSkeleton() { return <div className="space-y-6" aria-label="Loading dashboard"><div className="h-24 animate-pulse rounded-lg bg-slate-200" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-lg border border-slate-200 bg-white" />)}</div><div className="grid gap-4 xl:grid-cols-2"><div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" /><div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" /></div></div>; }
