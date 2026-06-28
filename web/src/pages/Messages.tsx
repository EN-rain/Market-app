import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { PaginatedConversations, Conversation } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/AppShell'

function fetchConversations() {
  return api.get<PaginatedConversations>('/conversations', {
    params: { page: 1, limit: 50 },
  })
}

function getOtherUser(conversation: Conversation, currentUserId: number) {
  return conversation.buyerId === currentUserId ? conversation.seller : conversation.buyer
}

function isUnread(conversation: Conversation, currentUserId: number) {
  const lastMsg = conversation.messages[0]
  if (!lastMsg) return false
  return lastMsg.senderId !== currentUserId && !lastMsg.isRead
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

function getInitials(name?: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Messages() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const currentUserId = user?.id ?? 0

  const { data, status, error, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    select: (res) => res.data,
    enabled: !!user,
    refetchOnMount: 'always',
  })

  const conversations = data?.items ?? []

  return (
    <AppShell>
      <div className="w-full max-w-3xl mx-auto">
        <div className="px-4 py-4 md:px-6 md:py-6">
          <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-4">
            Messages
          </h1>

          {status === 'pending' && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-12 text-error">
              <p>Failed to load conversations</p>
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

          {status === 'success' && conversations.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              <p>No messages yet</p>
              <p className="text-sm text-text-muted mt-1">
                Start a conversation from a listing
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {conversations.map((conversation) => {
              const otherUser = getOtherUser(conversation, currentUserId)
              const lastMessage = conversation.messages[0]
              const unread = isUnread(conversation, currentUserId)
              const listingImage = conversation.listing?.images?.[0]?.imageUrl
              const listingLabel = conversation.listing
                ? `${conversation.listing.brand} ${conversation.listing.model}`
                : undefined

              return (
                <button
                  key={conversation.id}
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-surface border border-card-border hover:bg-surface-high transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {otherUser.profileImage ? (
                      <img
                        src={otherUser.profileImage}
                        alt={otherUser.displayName ?? 'User'}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                        {getInitials(otherUser.displayName)}
                      </div>
                    )}
                    {unread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-error rounded-full border-2 border-surface" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary truncate">
                        {otherUser.displayName ?? 'Unknown'}
                      </span>
                      {lastMessage && (
                        <span className="text-xs text-text-muted shrink-0">
                          {formatRelativeTime(lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p
                        className={`text-sm truncate ${
                          unread ? 'text-text-primary font-medium' : 'text-text-secondary'
                        }`}
                      >
                        {lastMessage ? lastMessage.content : 'No messages yet'}
                      </p>
                    </div>
                    {listingLabel && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {listingLabel}
                      </p>
                    )}
                  </div>

                  {/* Listing thumbnail */}
                  {listingImage && (
                    <img
                      src={listingImage}
                      alt={listingLabel ?? 'Listing'}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
