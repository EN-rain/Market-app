import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import AppShell from '../components/AppShell'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { Listing } from '../lib/types'
import HeartIcon from '../components/icons/HeartIcon'
import LocationIcon from '../components/icons/LocationIcon'
import { getAssetUrl, getListingImageUrl } from '../lib/config'

function fetchListing(id: string) {
  return api.get<Listing>(`/listings/${id}`)
}

export default function ListingDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const listingId = id ? parseInt(id, 10) : NaN

  const { data, isPending, error } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchListing(id!),
    enabled: !!id && !isNaN(listingId),
  })

  const listing = data?.data

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (!listing) return
      if (listing.isFavourite) {
        await api.delete(`/favorites/${listing.id}`)
      } else {
        await api.post('/favorites', { listingId: listing.id })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const handleContact = () => {
    if (!isAuthenticated) {
      alert('Please sign in to contact the seller')
      navigate('/login')
      return
    }
    if (!listing) return
    if (user?.id === listing.sellerId) {
      alert('This is your own listing')
      return
    }
    navigate(`/chat/${listing.sellerId}`)
  }

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      alert('Please sign in to add favorites')
      navigate('/login')
      return
    }
    favoriteMutation.mutate()
  }

  if (isPending) {
    return (
      <AppShell>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <p className="text-error font-medium">Failed to load listing</p>
          <p className="text-sm text-text-muted mt-2">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error as Error).message}
          </p>
        </div>
      </AppShell>
    )
  }

  if (!listing) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <p className="text-text-secondary font-medium">Listing not found</p>
        </div>
      </AppShell>
    )
  }

  const images = listing.images ?? []
  const mainImage = getListingImageUrl(images[selectedImageIndex])
  const seller = listing.seller
  const isOwner = user?.id === listing.sellerId

  return (
    <AppShell>
      <div className="px-4 py-4 md:px-6 md:py-6 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {/* Image gallery */}
          <div className="w-full lg:w-1/2 space-y-3">
            <div className="aspect-square rounded-xl border border-card-border bg-surface-high overflow-hidden relative">
              {mainImage ? (
                <img
                  src={getAssetUrl(mainImage)}
                  alt={`${listing.brand} ${listing.model}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted">
                  <span className="text-sm">No image</span>
                </div>
              )}
              {listing.status === 'sold' && (
                <span className="absolute top-3 left-3 bg-foreground/80 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
                  Sold
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg border overflow-hidden ${
                      idx === selectedImageIndex
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-card-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getListingImageUrl(img)}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="w-full lg:w-1/2 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-text-primary">
                  {listing.brand} {listing.model}
                </h1>
                <p className="text-2xl md:text-3xl font-bold text-primary mt-1">
                  ${listing.price.toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleToggleFavorite}
                disabled={favoriteMutation.isPending}
                className="p-2.5 rounded-full bg-surface border border-card-border hover:bg-surface-high transition-colors flex-shrink-0"
                aria-label={listing.isFavourite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <HeartIcon
                  filled={listing.isFavourite}
                  className={`w-6 h-6 ${listing.isFavourite ? 'text-error' : 'text-text-muted'}`}
                />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-lg bg-surface-high text-sm text-text-secondary font-medium border border-card-border">
                {listing.condition}
              </span>
              {listing.storage && (
                <span className="px-3 py-1 rounded-lg bg-surface-high text-sm text-text-secondary font-medium border border-card-border">
                  {listing.storage}
                </span>
              )}
              {listing.colour && (
                <span className="px-3 py-1 rounded-lg bg-surface-high text-sm text-text-secondary font-medium border border-card-border">
                  {listing.colour}
                </span>
              )}
            </div>

            {listing.location && (
              <div className="flex items-center gap-1.5 text-text-secondary text-sm">
                <LocationIcon className="w-4 h-4" />
                <span>{listing.location}</span>
              </div>
            )}

            <div className="border-t border-card-border pt-4">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-2">
                Description
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                {listing.description || 'No description provided.'}
              </p>
            </div>

            {/* Seller info */}
            <div className="border-t border-card-border pt-4">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
                Seller
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-high border border-card-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {seller?.profileImage ? (
                    <img
                      src={getAssetUrl(seller.profileImage)}
                      alt={seller.displayName || 'Seller'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-text-secondary">
                      {(seller?.displayName || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {seller?.displayName || 'Unknown seller'}
                  </p>
                  <p className="text-xs text-text-muted">
                    Member since {new Date(listing.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact button */}
            <div className="pt-2">
              <button
                onClick={handleContact}
                className="w-full py-3 px-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {isOwner ? 'This is your listing' : 'Contact seller'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
