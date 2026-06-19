import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface ReportItem {
  id: number;
  reason: string;
  details?: string | null;
  status: string;
  reporter?: { email?: string | null } | null;
  conversation?: {
    messages?: Array<{ id: number; senderId: number; content: string }>;
  } | null;
}

interface ReportsResponse {
  items: ReportItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const PAGE_SIZE = 10;

export function Reports() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const reportsQuery = useQuery({
    queryKey: ['admin', 'reports', status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      return (await api.get<ReportsResponse>(`/admin/reports?${params.toString()}`)).data;
    },
    placeholderData: (previous) => previous,
    staleTime: 20_000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, next }: { id: number; next: 'reviewed' | 'dismissed' }) => {
      await api.post(`/admin/reports/${id}/${next === 'dismissed' ? 'dismiss' : 'resolve'}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
      ]);
    },
  });

  const data = reportsQuery.data;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, data?.pages ?? 1);

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">{data ? `${data.total.toLocaleString()} reports` : 'Loading reports'}</p>
        </div>
        <div className="admin-toolbar">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="admin-filter w-full sm:w-auto"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button
            type="button"
            onClick={() => reportsQuery.refetch()}
            disabled={reportsQuery.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {reportsQuery.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {reportsQuery.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load reports.
        </div>
      )}

      {resolveMutation.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to update the report.
        </div>
      )}

      {reportsQuery.isLoading ? (
        <ReportsSkeleton />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white divide-y">
          {items.map((report) => {
            const isUpdating = resolveMutation.isPending && resolveMutation.variables?.id === report.id;
            return (
              <div key={report.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {report.reason} <span className="text-sm text-gray-500">#{report.id}</span>
                      </p>
                      <p className="text-sm text-gray-600">{report.details || 'No details'}</p>
                      <p className="text-xs text-gray-500">Reporter: {report.reporter?.email || 'Unknown'}</p>
                    </div>
                    <span className="text-sm capitalize">{report.status}</span>
                  </div>

                  {report.conversation?.messages?.length ? (
                    <div className="max-h-40 overflow-auto rounded bg-gray-50 p-3 text-sm">
                      {report.conversation.messages.map((message) => (
                        <p key={message.id}>
                          <b>{message.senderId}:</b> {message.content}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 lg:items-start">
                  <button
                    disabled={isUpdating}
                    onClick={() => resolveMutation.mutate({ id: report.id, next: 'reviewed' })}
                    className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    Resolve
                  </button>
                  <button
                    disabled={isUpdating}
                    onClick={() => resolveMutation.mutate({ id: report.id, next: 'dismissed' })}
                    className="rounded bg-gray-700 px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div className="p-8 text-center text-gray-500">No reports</div>}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || reportsQuery.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || reportsQuery.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-white divide-y">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-3 p-4">
          <div className="h-5 w-52 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
