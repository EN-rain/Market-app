import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface ActivityItem {
  id: number;
  action: string;
  targetType: string;
  targetId: string;
  adminId: string;
}

interface ActivityResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const PAGE_SIZE = 20;

export function Activity() {
  const [page, setPage] = useState(1);
  const activityQuery = useQuery({
    queryKey: ['admin', 'activity', page],
    queryFn: async () => (await api.get<ActivityResponse>(`/admin/activity?page=${page}&limit=${PAGE_SIZE}`)).data,
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const data = activityQuery.data;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, data?.pages ?? 1);

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Activity Log</h1>
          <p className="mt-1 text-sm text-slate-500">{data ? `${data.total.toLocaleString()} activity records` : 'Loading activity'}</p>
        </div>
        <button
          type="button"
          onClick={() => activityQuery.refetch()}
          disabled={activityQuery.isFetching}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {activityQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {activityQuery.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load activity.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white divide-y">
        {activityQuery.isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-52 animate-pulse rounded bg-slate-100" />
              </div>
            ))
          : items.map((item) => (
              <div key={item.id} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p className="font-medium">{item.action}</p>
                <p className="text-sm text-gray-500">{item.targetType} #{item.targetId} by admin #{item.adminId}</p>
              </div>
            ))}
        {!activityQuery.isLoading && items.length === 0 && <div className="p-8 text-center text-gray-500">No activity yet</div>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || activityQuery.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || activityQuery.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
