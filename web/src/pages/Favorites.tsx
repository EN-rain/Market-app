import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { PaginatedListings } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/AppShell'
import ListingCard from '../components/ListingCard'

const PAGE_SIZE = 12

function fetchFavorites({ pageParam = 1 }: { pageParam?: number }) {
  return api.get<PaginatedListings>('/listings', {
    params: { page: pageParam, limit: PAGE_SIZE, favorited: '1' },
  })
}

export default function Favorites() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['listings', 'favorites'],
    queryFn: fetchFavorites,
    getNextPageParam: (lastPage) => {
      const { page, pages } = lastPage.data
      return page < pages ? page + 1 : undefined
    },
    initialPageParam: 1,
    enabled: isAuthenticated,
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

  const handleUnfavorite = async (id: number) => {
    try {
      await api.delete(`/favorites/${id}`)
      await queryClient.invalidateQueries({ queryKey: ['listings', 'favorites'] })
    } catch {
      // silently ignore — the listing will still show until next refresh
    }
  }

  const listings = data?.pages.flatMap((p) => p.data.items) ?? []

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="px-4 py-12 md:px-6 max-w-7xl mx-auto text-center">
          <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-2">
            Favorites
          </h1>
          <p className="text-text-secondary mb-4">
            Sign in to view your saved listings
          </p>
          <Link
            to="/login"
            className="inline-block bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="px-4 py-4 md:px-6 md:py-6 max-w-7xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-4">
          Favorites
        </h1>

        {status === 'pending' && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12 text-error">
            <p>Failed to load favorites</p>
            <p className="text-sm text-text-muted mt-1">
              {(error as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.response?.data?.message || (error as Error).message}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {listings.length === 0 && status === 'success' && (
          <div className="text-center py-12 text-text-secondary">
            <p>No favorites yet</p>
            <p className="text-sm text-text-muted mt-1">
              Tap the heart on any listing to save it here
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Browse listings
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={{ ...listing, isFavourite: true }}
              onToggleFavorite={handleUnfavorite}
            />
          ))}
        </div>

        <div ref={loadMoreRef} className="h-8 flex justify-center items-center mt-4">
          {isFetchingNextPage && (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>
    </AppShell>
  )
}
