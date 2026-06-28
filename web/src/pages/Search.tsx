import { useState, useEffect, useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { PaginatedListings } from '../lib/types'
import AppShell from '../components/AppShell'
import ListingCard from '../components/ListingCard'
import SearchIcon from '../components/icons/SearchIcon'

const PAGE_SIZE = 12

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor']
const STORAGES = ['64GB', '128GB', '256GB', '512GB', '1TB']
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

function fetchSearch({ pageParam = 1, filters }: { pageParam?: number; filters: Record<string, string> }) {
  const params: Record<string, string | number> = { page: pageParam, limit: PAGE_SIZE, status: 'active' }
  Object.entries(filters).forEach(([key, value]) => {
    if (value && key !== 'page' && key !== 'limit') params[key] = value
  })
  return api.get<PaginatedListings>('/listings', { params })
}

export default function Search() {
  const [q, setQ] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [condition, setCondition] = useState('')
  const [storage, setStorage] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [location, setLocation] = useState('')
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({ sort: 'newest' })

  const buildFilters = useCallback(() => {
    const f: Record<string, string> = { sort }
    if (q.trim()) f.q = q.trim() // q=
    if (brand.trim()) f.brand = brand.trim()
    if (model.trim()) f.model = model.trim()
    if (condition) f.condition = condition
    if (storage) f.storage = storage
    if (minPrice) f.minPrice = minPrice
    if (maxPrice) f.maxPrice = maxPrice
    if (location.trim()) f.location = location.trim()
    return f
  }, [q, brand, model, condition, storage, minPrice, maxPrice, location, sort])

  const handleSearch = () => {
    setAppliedFilters(buildFilters())
  }

  const clearFilters = () => {
    setQ('')
    setBrand('')
    setModel('')
    setCondition('')
    setStorage('')
    setMinPrice('')
    setMaxPrice('')
    setLocation('')
    setSort('newest')
    setAppliedFilters({ sort: 'newest' })
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, error, refetch } =
    useInfiniteQuery({
      queryKey: ['listings', 'search', appliedFilters],
      queryFn: ({ pageParam }) => fetchSearch({ pageParam, filters: appliedFilters }),
      getNextPageParam: (lastPage) => {
        const { page, pages } = lastPage.data
        return page < pages ? page + 1 : undefined
      },
      initialPageParam: 1,
    })

  useEffect(() => {
    refetch()
  }, [appliedFilters, refetch])

  const listings = data?.pages.flatMap((p) => p.data.items) ?? []
  const activeFilterCount = Object.keys(appliedFilters).filter((k) => k !== 'sort' && appliedFilters[k]).length

  return (
    <AppShell>
      <div className="px-4 py-4 md:px-6 md:py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search brand, model..."
              className="w-full rounded-xl border border-input-border bg-surface pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-xl bg-primary text-white font-medium px-5 py-3 text-sm hover:bg-primary-dark transition-colors"
          >
            Search
          </button>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="rounded-xl border border-card-border bg-surface text-text-secondary font-medium px-4 py-3 text-sm hover:bg-surface-high transition-colors whitespace-nowrap"
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {showFilters && (
          <div className="bg-surface rounded-xl border border-card-border p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Apple"
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. iPhone 15"
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Condition</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Any</option>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Storage</label>
                <select
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Any</option>
                  {STORAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Min price</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Max price</label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="9999"
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. New York"
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Sort</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={clearFilters}
                className="rounded-lg border border-card-border text-text-secondary px-4 py-2 text-sm hover:bg-surface-high transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSearch}
                className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary-dark transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {status === 'pending' && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12 text-error">
            <p>Failed to load results</p>
            <p className="text-sm text-text-muted mt-1">
              {(error as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.response?.data?.message || (error as Error).message}
            </p>
          </div>
        )}

        {listings.length === 0 && status === 'success' && (
          <div className="text-center py-12 text-text-secondary">
            <p>No results found</p>
            <p className="text-sm text-text-muted mt-1">Try adjusting your filters</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>

        {hasNextPage && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-xl bg-primary text-white font-medium px-6 py-2.5 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
