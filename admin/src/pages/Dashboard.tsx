import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardData {
  metrics: {
    totalUsers: number;
    totalListings: number;
    pendingListings: number;
    activeListings: number;
    rejectedListings: number;
    totalReports: number;
    totalFavorites: number;
    totalMessages: number;
  };
  recentListings: Array<{
    id: string;
    brand: string;
    model: string;
    price: number;
    status: string;
    createdAt: string;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    createdAt: string;
  }>;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const METRIC_LABELS: Record<string, string> = {
  totalUsers: 'Total Users',
  totalListings: 'Total Listings',
  pendingListings: 'Pending',
  activeListings: 'Active',
  rejectedListings: 'Rejected',
  totalReports: 'Reports',
  totalFavorites: 'Favorites',
  totalMessages: 'Messages',
};

export function Dashboard() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/admin/dashboard')).data,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p>Failed to load dashboard data.</p>
        <button className="mt-3 rounded bg-red-700 px-3 py-2 text-sm font-medium text-white" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const { metrics } = data;

  const barData = [
    { name: 'Pending', value: metrics.pendingListings },
    { name: 'Active', value: metrics.activeListings },
    { name: 'Rejected', value: metrics.rejectedListings },
  ];

  const pieData = [
    { name: 'Active', value: metrics.activeListings },
    { name: 'Pending', value: metrics.pendingListings },
    { name: 'Rejected', value: metrics.rejectedListings },
  ];

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Cached results refresh automatically in the background.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <p className="text-sm text-gray-500 font-medium">{METRIC_LABELS[key] || key}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Listings by Status</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Status Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                label
              >
                {pieData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,.8fr)_minmax(0,1.2fr)]">
        {/* Recent activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recentActivity && data.recentActivity.length > 0 ? (
              data.recentActivity.map((activity, idx) => (
                <div key={idx} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 capitalize">{activity.type}</p>
                    <p className="truncate text-sm text-gray-500">{activity.description}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">No recent activity</div>
            )}
          </div>
        </div>

        {/* Recent listings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Recent Listings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[620px]">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentListings && data.recentListings.length > 0 ? (
                  data.recentListings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-gray-50">
                      <td className="font-medium text-gray-900">{listing.brand}</td>
                      <td className="text-gray-600">{listing.model}</td>
                      <td className="text-gray-900">${Number(listing.price).toLocaleString()}</td>
                      <td>
                        <StatusBadge status={listing.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No recent listings
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="h-9 w-44 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
        <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
