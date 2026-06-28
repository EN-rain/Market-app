import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import AppShell from '../components/AppShell'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { User, Listing } from '../lib/types'
import LocationIcon from '../components/icons/LocationIcon'

/* ------------------------------------------------------------------ */
// Types & helpers
/* ------------------------------------------------------------------ */

interface NotificationPayload {
  email: boolean
  push: boolean
}

function getInitials(name?: string, email?: string): string {
  if (name?.trim()) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email?.trim()) {
    return email[0].toUpperCase()
  }
  return 'U'
}

/* ------------------------------------------------------------------ */
// API helpers
/* ------------------------------------------------------------------ */

function fetchProfile() {
  return api.get<User>('/users/me')
}

function fetchMyListings() {
  return api.get<Listing[]>('/users/me/listings')
}

function updateProfileText(payload: { displayName: string; location: string }) {
  return api.patch('/users/me', payload)
}

function updateProfileImage(formData: FormData) {
  return api.patch('/users/me', formData, {
    headers: { 'Content-Type': undefined },
  })
}

function updateNotifications(payload: NotificationPayload) {
  return api.patch('/users/me/notifications', payload)
}

function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return api.post('/auth/change-password', payload)
}

function updateListingStatus(id: number, status: string) {
  return api.patch(`/listings/${id}`, { status })
}

function deleteListing(id: number) {
  return api.delete(`/listings/${id}`)
}

function deleteAccount() {
  return api.delete('/users/me')
}

/* ------------------------------------------------------------------ */
// MyListingCard sub-component
/* ------------------------------------------------------------------ */

function MyListingCard({
  listing,
  onMarkSold,
  onRepublish,
  onDelete,
  isPending,
}: {
  listing: Listing
  onMarkSold: (id: number) => void
  onRepublish: (id: number) => void
  onDelete: (id: number) => void
  isPending: boolean
}) {
  const imageUrl = listing.images?.[0]?.url

  return (
    <div className="bg-surface rounded-xl border border-card-border overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <a href={`/listing/${listing.id}`} className="block">
        <div className="aspect-square relative bg-surface-high">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${listing.brand} ${listing.model}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              <span className="text-sm">No image</span>
            </div>
          )}
          {listing.status === 'sold' && (
            <span className="absolute top-2 left-2 bg-foreground/80 text-white text-xs font-medium px-2 py-1 rounded-lg">
              Sold
            </span>
          )}
        </div>
        <div className="p-3 space-y-1">
          <p className="font-semibold text-text-primary line-clamp-1">
            {listing.brand} {listing.model}
          </p>
          <p className="text-sm font-bold text-primary">${listing.price.toLocaleString()}</p>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="bg-surface-high px-2 py-0.5 rounded-md">{listing.condition}</span>
            {listing.location && (
              <span className="flex items-center gap-0.5">
                <LocationIcon className="w-3 h-3" />
                {listing.location}
              </span>
            )}
          </div>
        </div>
      </a>
      <div className="px-3 pb-3 mt-auto flex flex-wrap gap-2">
        {listing.status === 'active' ? (
          <button
            onClick={() => onMarkSold(listing.id)}
            disabled={isPending}
            className="flex-1 rounded-lg bg-secondary/10 text-secondary text-xs font-medium px-3 py-2 hover:bg-secondary/20 transition-colors disabled:opacity-50"
          >
            Mark as sold
          </button>
        ) : (
          <button
            onClick={() => onRepublish(listing.id)}
            disabled={isPending}
            className="flex-1 rounded-lg bg-primary/10 text-primary text-xs font-medium px-3 py-2 hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            Republish
          </button>
        )}
        <button
          onClick={() => onDelete(listing.id)}
          disabled={isPending}
          className="flex-1 rounded-lg bg-error/10 text-error text-xs font-medium px-3 py-2 hover:bg-error/20 transition-colors disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
// Confirmation dialog
/* ------------------------------------------------------------------ */

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl border border-card-border shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary">{description}</p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-card-border text-text-secondary px-4 py-2.5 text-sm font-medium hover:bg-surface-high transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${
              danger ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
// Main Profile page
/* ------------------------------------------------------------------ */

export default function Profile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout, setUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Profile edit state ──
  const [isEditing, setIsEditing] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)

  // ── Password state ──
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // ── Dialogs ──
  const [deleteListingId, setDeleteListingId] = useState<number | null>(null)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)

  // ── Queries ──
  const {
    data: profileRes,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: fetchProfile,
  })

  const profile = profileRes?.data ?? null

  const {
    data: listingsRes,
    isLoading: listingsLoading,
    error: listingsError,
    refetch: refetchListings,
  } = useQuery({
    queryKey: ['users', 'me', 'listings'],
    queryFn: fetchMyListings,
    enabled: !!profile?.id,
  })

  const myListings = listingsRes?.data ?? []

  // ── Notification local optimistic state ──
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(true)
  const [notifLoading, setNotifLoading] = useState(false)

  // Sync local notification state when profile loads
  useEffect(() => {
    if (profile?.notificationPreferences) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifEmail(profile.notificationPreferences.messages ?? true)
      setNotifPush(profile.notificationPreferences.listingUpdates ?? true)
    }
  }, [profile])

  // ── Mutations ──

  const profileTextMutation = useMutation({
    mutationFn: updateProfileText,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
      setUser({ ...profile!, displayName: vars.displayName, location: vars.location })
      setIsEditing(false)
    },
  })

  const profileImageMutation = useMutation({
    mutationFn: updateProfileImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
      setEditImageFile(null)
      setEditImagePreview(null)
    },
  })

  const handleSaveProfile = () => {
    if (!editDisplayName.trim()) return
    profileTextMutation.mutate({ displayName: editDisplayName, location: editLocation })
    if (editImageFile) {
      const fd = new FormData()
      fd.append('profileImage', editImageFile)
      profileImageMutation.mutate(fd)
    }
  }

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEditImageFile(file)
    setEditImagePreview(URL.createObjectURL(file))
    e.target.value = ''
  }, [])

  const removePreview = useCallback(() => {
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    setEditImageFile(null)
    setEditImagePreview(null)
  }, [editImagePreview])

  const startEditing = () => {
    setEditDisplayName(profile?.displayName ?? '')
    setEditLocation(profile?.location ?? '')
    setEditImageFile(null)
    setEditImagePreview(null)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    setEditImageFile(null)
    setEditImagePreview(null)
  }

  // Notifications
  const notifMutation = useMutation({
    mutationFn: updateNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['users', 'me'] })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
      setNotifLoading(false)
    },
    onError: () => {
      setNotifLoading(false)
    },
  })

  const toggleNotif = (type: 'email' | 'push') => {
    setNotifLoading(true)
    const nextEmail = type === 'email' ? !notifEmail : notifEmail
    const nextPush = type === 'push' ? !notifPush : notifPush
    setNotifEmail(nextEmail)
    setNotifPush(nextPush)
    notifMutation.mutate({ email: nextEmail, push: nextPush })
  }

  // Listing actions
  const listingActionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateListingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'listings'] })
    },
  })

  const deleteListingMutation = useMutation({
    mutationFn: deleteListing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'listings'] })
      setDeleteListingId(null)
    },
  })

  // Password
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordSuccess('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    },
    onError: (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
      setPasswordError(err?.response?.data?.message || 'Failed to change password.')
    },
  })

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }
    passwordMutation.mutate({ currentPassword, newPassword })
  }

  // Delete account
  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      setShowDeleteAccount(false)
      await logout()
      navigate('/login')
    },
    onError: (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
      alert(err?.response?.data?.message || 'Failed to delete account.')
    },
  })

  // ── Loading / error guards ──
  if (profileLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (profileError) {
    return (
      <AppShell>
        <div className="text-center py-20 text-error">
          <p>Failed to load profile</p>
          <p className="text-sm text-text-muted mt-1">
            {(profileError as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.response?.data?.message || (profileError as Error).message}
          </p>
        </div>
      </AppShell>
    )
  }

  // ── Derived UI values ──
  const initials = getInitials(profile?.displayName, profile?.email)
  const profileImageUrl = editImagePreview || profile?.profileImage

  // ── Render ──
  return (
    <AppShell>
      <div className="px-4 py-4 md:px-6 md:py-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column: Profile info ── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile card */}
            <div className="bg-surface rounded-2xl border border-card-border p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0 overflow-hidden">
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-text-primary truncate">
                    {profile?.displayName || profile?.email || 'User'}
                  </h2>
                  <p className="text-sm text-text-secondary truncate">{profile?.email}</p>
                  {profile?.location && (
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                      <LocationIcon className="w-3 h-3" />
                      {profile.location}
                    </p>
                  )}
                </div>
              </div>

              {!isEditing ? (
                <button
                  onClick={startEditing}
                  className="w-full rounded-xl bg-primary text-white font-medium py-2.5 text-sm hover:bg-primary-dark transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="space-y-4">
                  {/* Image upload */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Profile photo
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
                        {editImagePreview ? (
                          <img
                            src={editImagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : profile?.profileImage ? (
                          <img
                            src={profile.profileImage}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-lg border border-card-border text-text-secondary px-3 py-1.5 text-xs font-medium hover:bg-surface-high transition-colors"
                        >
                          {editImagePreview || profile?.profileImage ? 'Change' : 'Upload'}
                        </button>
                        {(editImagePreview || profile?.profileImage) && (
                          <button
                            type="button"
                            onClick={removePreview}
                            className="rounded-lg border border-card-border text-error px-3 py-1.5 text-xs font-medium hover:bg-error/5 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </div>
                  </div>

                  {/* Display name */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Display name
                    </label>
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-input-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="e.g. London, UK"
                      className="w-full rounded-xl border border-input-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={cancelEditing}
                      className="flex-1 rounded-xl border border-card-border text-text-secondary font-medium py-2.5 text-sm hover:bg-surface-high transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={!editDisplayName.trim() || profileTextMutation.isPending}
                      className="flex-1 rounded-xl bg-primary text-white font-medium py-2.5 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {profileTextMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notification preferences */}
            <div className="bg-surface rounded-2xl border border-card-border p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                Notifications
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Email notifications</span>
                  <button
                    onClick={() => toggleNotif('email')}
                    disabled={notifLoading}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notifEmail ? 'bg-primary' : 'bg-surface-high'
                    } ${notifLoading ? 'opacity-60' : ''}`}
                    aria-pressed={notifEmail}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifEmail ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Push notifications</span>
                  <button
                    onClick={() => toggleNotif('push')}
                    disabled={notifLoading}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notifPush ? 'bg-primary' : 'bg-surface-high'
                    } ${notifLoading ? 'opacity-60' : ''}`}
                    aria-pressed={notifPush}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifPush ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Change password */}
            <div className="bg-surface rounded-2xl border border-card-border p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                Change Password
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full rounded-xl border border-input-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full rounded-xl border border-input-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full rounded-xl border border-input-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {passwordError && (
                  <p className="text-error text-xs">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="text-primary text-xs">{passwordSuccess}</p>
                )}
                <button
                  type="submit"
                  disabled={passwordMutation.isPending}
                  className="w-full rounded-xl bg-secondary text-white font-medium py-2.5 text-sm hover:bg-secondary/90 transition-colors disabled:opacity-60"
                >
                  {passwordMutation.isPending ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </div>

            {/* Delete account */}
            <div className="bg-surface rounded-2xl border border-card-border p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
                Danger Zone
              </h3>
              <button
                onClick={() => setShowDeleteAccount(true)}
                className="w-full rounded-xl bg-error text-white font-medium py-2.5 text-sm hover:bg-error/90 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>

          {/* ── Right column: My listings ── */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-text-primary mb-4">My Listings</h2>

            {listingsLoading && (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {listingsError && (
              <div className="text-center py-12 text-error">
                <p>Failed to load listings</p>
                <p className="text-sm text-text-muted mt-1">
                  {(listingsError as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.response?.data?.message ||
                    (listingsError as Error).message}
                </p>
                <button
                  onClick={() => refetchListings()}
                  className="mt-3 rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary-dark transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!listingsLoading && !listingsError && myListings.length === 0 && (
              <div className="text-center py-12 text-text-secondary bg-surface rounded-2xl border border-card-border">
                <p className="font-medium">No listings yet</p>
                <p className="text-sm text-text-muted mt-1">
                  Start selling by creating a new listing
                </p>
              </div>
            )}

            {!listingsLoading && !listingsError && myListings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {myListings.map((listing) => (
                  <MyListingCard
                    key={listing.id}
                    listing={listing}
                    onMarkSold={(id) => listingActionMutation.mutate({ id, status: 'sold' })}
                    onRepublish={(id) => listingActionMutation.mutate({ id, status: 'active' })}
                    onDelete={(id) => setDeleteListingId(id)}
                    isPending={listingActionMutation.isPending || deleteListingMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete listing confirmation */}
      <ConfirmDialog
        open={!!deleteListingId}
        title="Delete listing?"
        description="This action cannot be undone. The listing will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteListingId && deleteListingMutation.mutate(deleteListingId)}
        onCancel={() => setDeleteListingId(null)}
      />

      {/* Delete account confirmation */}
      <ConfirmDialog
        open={showDeleteAccount}
        title="Delete your account?"
        description="This will permanently delete your account and all your listings. This action cannot be undone."
        confirmLabel="Delete account"
        danger
        onConfirm={() => deleteAccountMutation.mutate()}
        onCancel={() => setShowDeleteAccount(false)}
      />
    </AppShell>
  )
}
