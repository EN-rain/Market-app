import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface User {
  id: number;
  email: string;
  displayName?: string;
  role: string;
  accountStatus: 'active' | 'suspended' | string;
  suspensionReason?: string;
  createdAt: string;
}

interface UsersResponse {
  items: User[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const PAGE_SIZE = 10;

export function Users() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { page, statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter) params.set('accountStatus', statusFilter);
      return (await api.get<UsersResponse>(`/admin/users?${params.toString()}`)).data;
    },
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ]);
  };

  const suspendMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      await api.post(`/admin/users/${id}/suspend`, { reason });
    },
    onSuccess: async () => {
      setSuspendTarget(null);
      setReason('');
      await invalidateUsers();
    },
    onError: () => setLocalError('Failed to suspend user'),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/admin/users/${id}/restore`);
    },
    onSuccess: async () => {
      setRestoreTarget(null);
      await invalidateUsers();
    },
    onError: () => setLocalError('Failed to restore user'),
  });

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, usersQuery.data?.pages ?? 1);

  const submitSuspend = () => {
    if (!suspendTarget) return;
    setLocalError(null);
    suspendMutation.mutate({ id: suspendTarget.id, reason: reason.trim() || undefined });
  };

  const submitRestore = () => {
    if (!restoreTarget) return;
    setLocalError(null);
    restoreMutation.mutate(restoreTarget.id);
  };

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="mt-1 text-sm text-slate-500">{usersQuery.data ? `${total.toLocaleString()} users` : 'Loading users'}</p>
        </div>
        <div className="admin-toolbar">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="admin-filter w-full sm:w-auto"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button
            type="button"
            onClick={() => usersQuery.refetch()}
            disabled={usersQuery.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {usersQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {(localError || usersQuery.isError) && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
          {localError || 'Failed to load users'}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className={usersQuery.isLoading || items.length > 0 ? 'overflow-x-auto' : 'hidden'}>
          <table className="admin-table min-w-[920px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="w-20">ID</th>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usersQuery.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={7}>
                        <div className="h-10 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))
                : items.map((user) => {
                    const isBusy = suspendMutation.variables?.id === user.id || restoreMutation.variables === user.id;
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="font-mono text-xs text-gray-500">{user.id}</td>
                        <td className="max-w-[280px] truncate text-gray-600">{user.email}</td>
                        <td className="max-w-[220px] truncate text-gray-600">{user.displayName || '-'}</td>
                        <td>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                            {user.role}
                          </span>
                        </td>
                        <td><StatusBadge status={user.accountStatus} /></td>
                        <td className="text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {user.accountStatus === 'active' ? (
                              <button
                                onClick={() => {
                                  setSuspendTarget(user);
                                  setReason('');
                                }}
                                disabled={isBusy}
                                className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => setRestoreTarget(user)}
                                disabled={isBusy}
                                className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!usersQuery.isLoading && items.length === 0 && (
          <div className="border-t border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
            No users found
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">Showing {items.length} of {total} users</p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || usersQuery.isFetching}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || usersQuery.isFetching}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {(suspendTarget || restoreTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="admin-surface w-full max-w-md p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {suspendTarget ? 'Suspend user' : 'Restore user'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {(suspendTarget ?? restoreTarget)?.email}
            </p>
            {suspendTarget && (
              <>
                <label className="mt-4 block text-sm font-medium text-slate-700">Reason</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                />
              </>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSuspendTarget(null);
                  setRestoreTarget(null);
                  setReason('');
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={suspendTarget ? submitSuspend : submitRestore}
                disabled={suspendMutation.isPending || restoreMutation.isPending}
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
