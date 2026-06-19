import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { cloudinaryImageUrl } from '../lib/images.js';

interface Listing {
  id: number;
  brand: string;
  model: string;
  price: number;
  status: 'pending' | 'active' | 'rejected' | 'sold' | 'removed' | 'expired';
  createdAt: string;
  images: Array<{ imageUrl: string; displayOrder: number }>;
}

interface ListingsResponse {
  items: Listing[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const PAGE_SIZE = 10;

export function Listings() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Listing | null>(null);
  const [priceTarget, setPriceTarget] = useState<Listing | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const listingsQuery = useQuery({
    queryKey: ['admin', 'listings', { page, statusFilter, brandFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter) params.set('status', statusFilter);
      if (brandFilter) params.set('brand', brandFilter);
      return (await api.get<ListingsResponse>(`/admin/listings?${params.toString()}`)).data;
    },
    placeholderData: (previous) => previous,
    staleTime: 20_000,
  });

  const firstPageQuery = useQuery({
    queryKey: ['admin', 'listings', 'brands-preview'],
    queryFn: async () => (await api.get<ListingsResponse>(`/admin/listings?page=1&limit=100`)).data,
    staleTime: 5 * 60_000,
  });

  const invalidateListings = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'approve' | 'remove' | 'restore' }) => {
      await api.post(`/admin/listings/${id}/${action}`);
    },
    onSuccess: invalidateListings,
    onError: (_error, variables) => setLocalError(`Failed to ${variables.action} listing`),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      await api.post(`/admin/listings/${id}/reject`, { reason });
    },
    onSuccess: async () => {
      setRejectTarget(null);
      setModalValue('');
      await invalidateListings();
    },
    onError: () => setLocalError('Failed to reject listing'),
  });

  const priceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: number; price: number }) => {
      await api.patch(`/admin/listings/${id}`, { price });
    },
    onSuccess: async () => {
      setPriceTarget(null);
      setModalValue('');
      await invalidateListings();
    },
    onError: () => setLocalError('Failed to update listing price'),
  });

  const items = listingsQuery.data?.items ?? [];
  const total = listingsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, listingsQuery.data?.pages ?? 1);
  const isMutating = statusMutation.isPending || rejectMutation.isPending || priceMutation.isPending;
  const brands = useMemo(() => {
    const source = firstPageQuery.data?.items ?? items;
    return Array.from(new Set(source.map((item) => item.brand))).filter(Boolean).sort();
  }, [firstPageQuery.data?.items, items]);

  const submitReject = () => {
    if (!rejectTarget) return;
    setLocalError(null);
    rejectMutation.mutate({ id: rejectTarget.id, reason: modalValue.trim() || undefined });
  };

  const submitPrice = () => {
    if (!priceTarget) return;
    const price = Number(modalValue);
    if (!Number.isInteger(price) || price < 1) {
      setLocalError('Enter a valid whole-number price above zero');
      return;
    }
    setLocalError(null);
    priceMutation.mutate({ id: priceTarget.id, price });
  };

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Listings</h1>
          <p className="mt-1 text-sm text-slate-500">{listingsQuery.data ? `${total.toLocaleString()} listings` : 'Loading listings'}</p>
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
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="sold">Sold</option>
            <option value="removed">Removed</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setPage(1);
            }}
            className="admin-filter w-full sm:w-auto"
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => listingsQuery.refetch()}
            disabled={listingsQuery.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {listingsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {(localError || listingsQuery.isError) && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
          {localError || 'Failed to load listings'}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className={listingsQuery.isLoading || items.length > 0 ? 'overflow-x-auto' : 'hidden'}>
          <table className="admin-table min-w-[1040px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="w-20">Thumbnail</th>
                <th className="w-20">ID</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Price</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listingsQuery.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={8}>
                        <div className="h-10 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))
                : items.map((item) => {
                    const itemBusy = isMutating && (
                      statusMutation.variables?.id === item.id ||
                      rejectMutation.variables?.id === item.id ||
                      priceMutation.variables?.id === item.id
                    );
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td>
                          {item.images && item.images.length > 0 ? (
                            <img
                              src={cloudinaryImageUrl(item.images[0].imageUrl, { width: 96, height: 96 })}
                              alt={`${item.brand} ${item.model}`}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gray-200" />
                          )}
                        </td>
                        <td className="font-mono text-xs text-gray-500">{item.id}</td>
                        <td className="font-medium text-gray-900">{item.brand}</td>
                        <td className="max-w-[220px] truncate text-gray-600">{item.model}</td>
                        <td className="text-gray-900">₱{Number(item.price).toLocaleString('en-PH')}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td className="text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {item.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => statusMutation.mutate({ id: item.id, action: 'approve' })}
                                  disabled={itemBusy}
                                  className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectTarget(item);
                                    setModalValue('');
                                  }}
                                  disabled={itemBusy}
                                  className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {item.status !== 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setPriceTarget(item);
                                    setModalValue(String(item.price));
                                  }}
                                  disabled={itemBusy}
                                  className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded disabled:opacity-50"
                                >
                                  Edit
                                </button>
                                {item.status !== 'removed' && (
                                  <button
                                    onClick={() => statusMutation.mutate({ id: item.id, action: 'remove' })}
                                    disabled={itemBusy}
                                    className="px-2 py-1 text-xs font-medium bg-gray-700 text-white rounded disabled:opacity-50"
                                  >
                                    Remove
                                  </button>
                                )}
                                {item.status === 'removed' && (
                                  <button
                                    onClick={() => statusMutation.mutate({ id: item.id, action: 'restore' })}
                                    disabled={itemBusy}
                                    className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded disabled:opacity-50"
                                  >
                                    Restore
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!listingsQuery.isLoading && items.length === 0 && (
          <div className="border-t border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
            No listings found
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">Showing {items.length} of {total} listings</p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || listingsQuery.isFetching}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || listingsQuery.isFetching}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {(rejectTarget || priceTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="admin-surface w-full max-w-md p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {rejectTarget ? 'Reject listing' : 'Edit price'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {rejectTarget
                ? `${rejectTarget.brand} ${rejectTarget.model}`
                : `${priceTarget?.brand ?? ''} ${priceTarget?.model ?? ''}`}
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              {rejectTarget ? 'Reason' : 'Price'}
            </label>
            <input
              value={modalValue}
              onChange={(e) => setModalValue(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
              type={rejectTarget ? 'text' : 'number'}
              min={1}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setPriceTarget(null);
                  setModalValue('');
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={rejectTarget ? submitReject : submitPrice}
                disabled={rejectMutation.isPending || priceMutation.isPending}
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Save
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
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    sold: 'bg-blue-100 text-blue-800',
    removed: 'bg-gray-100 text-gray-800',
    expired: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
