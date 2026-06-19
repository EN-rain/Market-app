import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api.js';

interface SearchAnalyticsResponse {
  topTerms: Array<{ term: string; count: number }>;
  zeroResults: Array<{ id: number; searchTerm: string }>;
}

export function Analytics() {
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['admin', 'analytics', 'search'],
    queryFn: async () => (await api.get<SearchAnalyticsResponse>('/admin/analytics/search')).data,
    staleTime: 60_000,
  });
  const analytics = data ?? { topTerms: [], zeroResults: [] };

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Search Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Cached for quick tab switching.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {isError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Failed to load analytics.</div>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Top Terms</h2>
          {isLoading ? (
            <div className="h-[300px] animate-pulse rounded bg-slate-100" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topTerms}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="term" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#111827" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Zero-result Searches</h2>
          <div className="max-h-[340px] divide-y overflow-auto">
            {isLoading
              ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="my-2 h-5 animate-pulse rounded bg-slate-100" />)
              : analytics.zeroResults.map((r) => <div key={r.id} className="py-2 text-sm">{r.searchTerm}</div>)}
            {!isLoading && analytics.zeroResults.length === 0 && <div className="py-8 text-center text-sm text-gray-500">No zero-result searches</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
