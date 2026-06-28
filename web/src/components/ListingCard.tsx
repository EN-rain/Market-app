import { Link } from 'react-router-dom'
import type { Listing } from '../lib/types'
import HeartIcon from './icons/HeartIcon'
import LocationIcon from './icons/LocationIcon'

interface ListingCardProps {
  listing: Listing
  onToggleFavorite?: (id: number) => void
}

const conditionColors: Record<string, string> = {
  new:           'bg-emerald-50 text-emerald-700',
  like_new:      'bg-surface-high text-primary',
  excellent:     'bg-surface-high text-primary',
  good:          'bg-blue-50 text-secondary',
  fair:          'bg-amber-50 text-amber-700',
  poor:          'bg-red-50 text-error',
}

export default function ListingCard({ listing, onToggleFavorite }: ListingCardProps) {
  const imageUrl = listing.images?.[0]?.url
  const conditionKey = listing.condition?.toLowerCase().replace(' ', '_') ?? ''
  const conditionClass = conditionColors[conditionKey] ?? 'bg-surface-high text-text-muted'

  return (
    <Link to={`/listing/${listing.id}`} className="block group cursor-pointer">
      <div
        className="bg-white rounded-xl border border-card-border overflow-hidden card-lift"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* ── Image ─────────────────────────────────── */}
        <div className="aspect-[4/3] relative bg-surface-high overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${listing.brand} ${listing.model}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-10 h-10 opacity-30"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs">No photo</span>
            </div>
          )}

          {/* Sold badge */}
          {listing.status === 'sold' && (
            <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide">
              SOLD
            </span>
          )}

          {/* Favourite button */}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.preventDefault()
                onToggleFavorite(listing.id)
              }}
              aria-label={listing.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className="absolute top-2 right-2 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-all duration-200 active:scale-90 cursor-pointer"
            >
              <HeartIcon
                filled={listing.isFavourite}
                className={`w-4 h-4 ${listing.isFavourite ? 'text-error' : 'text-text-muted'}`}
              />
            </button>
          )}
        </div>

        {/* ── Info ──────────────────────────────────── */}
        <div className="p-4 space-y-2">
          <p className="font-heading font-semibold text-text-primary text-sm md:text-base line-clamp-1 leading-snug">
            {listing.brand} {listing.model}
          </p>

          <p className="font-heading font-bold text-primary text-lg leading-none">
            ${listing.price.toLocaleString()}
          </p>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg capitalize ${conditionClass}`}>
              {listing.condition?.replace('_', ' ') ?? 'Unknown'}
            </span>
            {listing.location && (
              <span className="flex items-center gap-1 text-xs text-text-muted truncate max-w-[40%]">
                <LocationIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">{listing.location}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
