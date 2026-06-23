export interface User {
  id: number
  email: string
  role: string
  displayName?: string
  location?: string
  profileImage?: string
  emailVerified?: boolean
  notificationPreferences?: {
    messages?: boolean
    listingUpdates?: boolean
  }
}

export interface AuthResponse {
  accessToken: string
  user: User
}

export interface OtpResponse {
  success: boolean
  message: string
  expiresAt: string
}

export interface ListingImage {
  url: string
  publicId?: string
}

export interface Listing {
  id: number
  brand: string
  model: string
  price: number
  condition: string
  storage?: string
  colour?: string
  description?: string
  location?: string
  status: 'active' | 'sold'
  images: ListingImage[]
  sellerId: number
  seller?: User
  createdAt: string
  updatedAt: string
  isFavourite?: boolean
}

export interface PaginatedListings {
  items: Listing[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface Message {
  id: number
  conversationId: number
  senderId: number
  content: string
  createdAt: string
  isRead: boolean
  sender?: User
}

export interface ConversationParticipant {
  id: number
  displayName?: string
  profileImage?: string
  location?: string
}

export interface ConversationListing {
  id: number
  brand: string
  model: string
  images: { imageUrl: string }[]
}

export interface Conversation {
  id: number
  buyerId: number
  sellerId: number
  buyer: ConversationParticipant
  seller: ConversationParticipant
  listing?: ConversationListing
  messages: Message[]
  lastMessageAt?: string
  createdAt: string
}

export interface PaginatedConversations {
  items: Conversation[]
  total: number
  page: number
  limit: number
  pages: number
}
