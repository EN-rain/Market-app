import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { PaginatedListings } from '../lib/types'
import AppShell from '../components/AppShell'
import ListingCard from '../components/ListingCard'

const PAGE_SIZE = 12

function fetchListings({ pageParam = 1 }: { pageParam?: number }) {
  return api.get<PaginatedListings>('/listings', {
    params: { page: pageParam, limit: PAGE_SIZE, status: 'active', sort: 'newest' },
  })
}

export default function Home() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, error } =
    useInfiniteQuery({
      queryKey: ['listings', 'feed'],
      queryFn: fetchListings,
      getNextPageParam: (lastPage) => {
        const { page, pages } = lastPage.data
        return page < pages ? page + 1 : undefined
      },
      initialPageParam: 1,
    })

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observerRef.current.observe(loadMoreRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const listings = data?.pages.flatMap((p) => p.data.items) ?? []

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/search')
    }
  }

  return (
    <AppShell>
      {/* ── Hero ────────────────────────────────────────── */}
      <section className="hero-gradient border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-16">
          <div className="max-w-2xl">
            <h1 className="font-heading text-3xl md:text-5xl font-bold text-primary leading-tight mb-3 animate-slide-up">
              Buy &amp; sell phones
              <br />
              <span className="text-primary-light">in your pocket</span>
            </h1>
            <p className="text-text-muted text-base md:text-lg mb-8 animate-slide-up" style={{ animationDelay: '80ms' }}>
              Discover great deals on pre-loved smartphones near you.
            </p>

            {/* Search Bar */}
            <form
              onSubmit={handleSearch}
              className="flex items-center bg-white rounded-2xl border border-border-strong shadow-lg overflow-hidden animate-slide-up"
              style={{ animationDelay: '150ms' }}
            >
              <div className="flex items-center gap-2 flex-1 px-4 py-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-text-muted shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                    clipRule="evenodd"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by brand, model, or keyword…"
                  className="flex-1 text-base text-text-primary placeholder:text-text-muted bg-transparent outline-none py-3 min-w-0"
                  aria-label="Search listings"
                />
              </div>
              <button
                type="submit"
                className="m-1.5 bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:shadow-md cursor-pointer shrink-0"
              >
                Search
              </button>
            </form>

            {/* Quick links */}
            <div className="flex flex-wrap gap-2 mt-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
              {['iPhone 15', 'Samsung S24', 'Pixel 8', 'Under $300'].map((q) => (
                <button
                  key={q}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
                  className="text-xs text-text-secondary bg-white/80 hover:bg-white border border-border rounded-full px-3 py-1.5 transition-all duration-200 hover:border-primary hover:text-primary cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Listings Feed ─────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl md:text-2xl font-bold text-text-primary">
            Latest listings
          </h2>
          {listings.length > 0 && (
            <span className="text-sm text-text-muted">
              {listings.length} item{listings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {status === 'pending' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-card-border overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-surface-high" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-surface-high rounded w-3/4" />
                  <div className="h-5 bg-surface-high rounded w-1/3" />
                  <div className="h-4 bg-surface-high rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-7 h-7 text-error"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="font-heading font-semibold text-text-primary">Failed to load listings</p>
            <p className="text-sm text-text-muted mt-1">
              {(error as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.response?.data?.message || (error as Error).message}
            </p>
          </div>
        )}

        {/* Empty state */}
        {listings.length === 0 && status === 'success' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-hero flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-8 h-8 text-primary/60"
                aria-hidden="true"
              >
                <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
              </svg>
            </div>
            <p className="font-heading font-semibold text-text-primary text-lg">No listings yet</p>
            <p className="text-text-muted text-sm mt-1">Be the first to list an item for sale.</p>
          </div>
        )}

        {/* Listings grid */}
        {listings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Infinite scroll trigger / load more */}
        <div ref={loadMoreRef} className="h-12 flex justify-center items-center mt-6">
          {isFetchingNextPage && (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading more" />
          )}
          {!hasNextPage && listings.length > 0 && (
            <p className="text-sm text-text-muted">You've seen all listings.</p>
          )}
        </div>
      </section>
    </AppShell>
  )
}
