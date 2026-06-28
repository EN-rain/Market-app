import { useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import AppShell from '../components/AppShell'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { User, Listing, PaginatedListings } from '../lib/types'
import LocationIcon from '../components/icons/LocationIcon'
import { getAssetUrl, getListingImageUrl } from '../lib/config'

interface NotificationPayload {
  email: boolean
  push: boolean
}

interface ApiErrorShape {
  response?: {
    data?: {
      message?: string
    }
  }
}

type ListingStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'rejected'
  | 'sold'
  | 'removed'
  | 'expired'

function getInitials(name?: string, email?: string): string {
  if (name?.trim()) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email?.trim()) return email[0].toUpperCase()
  return 'U'
}

function fetchProfile() {
  return api.get<User>('/users/me')
}

function fetchMyListings() {
  return api.get<PaginatedListings>('/listings/mine', {
    params: { page: 1, limit: 60 },
  })
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

function formatMemberSince(value?: string) {
  if (!value) return 'Recently joined'
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const maybeApiError = error as ApiErrorShape | undefined
  if (maybeApiError?.response?.data?.message) return maybeApiError.response.data.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

async function buildCroppedImageFile(
  src: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })

  const frame = 320
  const baseScale = Math.max(frame / image.naturalWidth, frame / image.naturalHeight)
  const scale = baseScale * zoom
  const displayWidth = image.naturalWidth * scale
  const displayHeight = image.naturalHeight * scale
  const left = (frame - displayWidth) / 2 + offsetX
  const top = (frame - displayHeight) / 2 + offsetY

  const sourceX = clamp((0 - left) / scale, 0, image.naturalWidth)
  const sourceY = clamp((0 - top) / scale, 0, image.naturalHeight)
  const sourceWidth = clamp(frame / scale, 1, image.naturalWidth - sourceX)
  const sourceHeight = clamp(frame / scale, 1, image.naturalHeight - sourceY)

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to prepare crop canvas')

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Failed to create cropped image'))
    }, 'image/jpeg', 0.92)
  })

  return new File([blob], `profile-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

function statusTone(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-primary-soft text-primary'
    case 'pending':
      return 'bg-primary-soft text-primary'
    case 'sold':
      return 'bg-surface-high text-text-primary'
    case 'rejected':
    case 'removed':
      return 'bg-surface-high text-text-secondary'
    default:
      return 'bg-surface-high text-text-secondary'
  }
}

function OverviewIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M3.5 3.5A1.5 1.5 0 0 1 5 2h3.5A1.5 1.5 0 0 1 10 3.5V7A1.5 1.5 0 0 1 8.5 8.5H5A1.5 1.5 0 0 1 3.5 7V3.5ZM11.5 5A1.5 1.5 0 0 1 13 3.5h2A1.5 1.5 0 0 1 16.5 5v10A1.5 1.5 0 0 1 15 16.5h-2A1.5 1.5 0 0 1 11.5 15V5ZM3.5 12A1.5 1.5 0 0 1 5 10.5h3.5A1.5 1.5 0 0 1 10 12v3A1.5 1.5 0 0 1 8.5 16.5H5A1.5 1.5 0 0 1 3.5 15v-3Z" />
    </svg>
  )
}

function ListingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M3 4.25A2.25 2.25 0 0 1 5.25 2h9.5A2.25 2.25 0 0 1 17 4.25v11.5A2.25 2.25 0 0 1 14.75 18h-9.5A2.25 2.25 0 0 1 3 15.75V4.25Zm3 1a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5H6Zm0 4a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5H6Zm0 4a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5H6Z" />
    </svg>
  )
}

function SecurityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M10 1.75a.75.75 0 0 1 .31.067l5.5 2.5A.75.75 0 0 1 16.25 5v3.652c0 3.06-1.686 5.876-4.39 7.334l-1.51.815a.75.75 0 0 1-.7 0l-1.51-.815A8.38 8.38 0 0 1 3.75 8.652V5a.75.75 0 0 1 .44-.683l5.5-2.5A.75.75 0 0 1 10 1.75Zm2.03 5.72a.75.75 0 1 0-1.06-1.06L9.25 8.129l-.72-.72a.75.75 0 1 0-1.06 1.061l1.25 1.25a.75.75 0 0 0 1.06 0l2.25-2.25Z" clipRule="evenodd" />
    </svg>
  )
}

function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-card-border pt-5 md:pt-6 animate-panel-in">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                {icon}
              </span>
            )}
            <div>
              <h2 className="text-base font-semibold text-text-primary md:text-lg">{title}</h2>
              {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
            </div>
          </div>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone = 'primary',
}: {
  label: string
  value: string
  tone?: 'primary' | 'secondary' | 'tertiary' | 'neutral'
}) {
  const toneClass =
    tone === 'neutral'
      ? 'bg-surface-high text-text-primary'
      : 'bg-primary-soft text-primary'

  return (
    <div className="rounded-2xl border border-card-border bg-background p-4 motion-card">
      <div className={`inline-flex rounded-xl px-3 py-1 text-xs font-semibold ${toneClass}`}>{label}</div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-text-primary">{value}</div>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-card-border bg-background px-4 py-3 motion-card">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-surface-high'
        } ${disabled ? 'opacity-60' : ''}`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-overlay-in">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-surface p-6 shadow-xl animate-scale-in">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-card-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-high"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function CropDialog({
  open,
  imageSrc,
  zoom,
  offsetX,
  offsetY,
  busy,
  onZoomChange,
  onOffsetXChange,
  onOffsetYChange,
  onCancel,
  onApply,
}: {
  open: boolean
  imageSrc: string | null
  zoom: number
  offsetX: number
  offsetY: number
  busy: boolean
  onZoomChange: (value: number) => void
  onOffsetXChange: (value: number) => void
  onOffsetYChange: (value: number) => void
  onCancel: () => void
  onApply: () => void
}) {
  if (!open || !imageSrc) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-overlay-in">
      <div className="w-full max-w-xl rounded-3xl border border-card-border bg-surface p-5 shadow-xl animate-scale-in md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Edit profile photo</h3>
            <p className="mt-1 text-sm text-text-secondary">Adjust the crop, then replace your profile picture.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-high"
          >
            Cancel
          </button>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[320px_minmax(0,1fr)] md:items-start">
          <div className="mx-auto h-80 w-80 overflow-hidden rounded-[28px] border border-card-border bg-background shadow-[var(--shadow-card)]">
            <img
              src={imageSrc}
              alt="Crop preview"
              className="h-full w-full object-cover"
              style={{ transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})` }}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Zoom</label>
              <input type="range" min="1" max="2.6" step="0.01" value={zoom} onChange={(e) => onZoomChange(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Horizontal</label>
              <input type="range" min="-110" max="110" step="1" value={offsetX} onChange={(e) => onOffsetXChange(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Vertical</label>
              <input type="range" min="-110" max="110" step="1" value={offsetY} onChange={(e) => onOffsetYChange(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
            </div>
            <button
              type="button"
              onClick={onApply}
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? 'Applying...' : 'Apply photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const imageUrl = getListingImageUrl(listing.images?.[0])
  const canMarkSold = listing.status === 'active'
  const secondaryActionLabel = canMarkSold ? 'Mark sold' : 'Republish'
  const secondaryAction = canMarkSold ? onMarkSold : onRepublish

  return (
    <article className="overflow-hidden rounded-2xl border border-card-border bg-background transition-colors duration-200 hover:bg-surface motion-card animate-panel-in">
      <Link to={`/listing/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] bg-surface-high">
          {imageUrl ? (
            <img src={imageUrl} alt={`${listing.brand} ${listing.model}`} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-text-muted">No image</div>
          )}
          <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${statusTone(listing.status)}`}>
            {listing.status}
          </span>
        </div>
      </Link>
      <div className="space-y-4 p-4">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-text-primary">
                {listing.brand} {listing.model}
              </p>
              <p className="text-lg font-bold text-primary">{formatMoney(listing.price)}</p>
            </div>
            {listing.location && (
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <LocationIcon className="h-3.5 w-3.5" />
                <span className="max-w-20 truncate">{listing.location}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
            <span className="rounded-lg bg-surface-high px-2.5 py-1 capitalize">{listing.condition}</span>
            {listing.storage && <span className="rounded-lg bg-surface-high px-2.5 py-1">{listing.storage}</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => secondaryAction(listing.id)}
            disabled={isPending}
            className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft/80 disabled:opacity-50"
          >
            {secondaryActionLabel}
          </button>
          <button
            onClick={() => onDelete(listing.id)}
            disabled={isPending}
            className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-high disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout, setUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [cropZoom, setCropZoom] = useState(1)
  const [cropOffsetX, setCropOffsetX] = useState(0)
  const [cropOffsetY, setCropOffsetY] = useState(0)
  const [cropBusy, setCropBusy] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [securityOpen, setSecurityOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [deleteListingId, setDeleteListingId] = useState<number | null>(null)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [notifOverride, setNotifOverride] = useState<NotificationPayload | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)

  const { data: profileRes, isLoading: profileLoading, error: profileError } = useQuery({
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
  const myListings = listingsRes?.data.items ?? []

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

  const notifMutation = useMutation({
    mutationFn: updateNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['users', 'me'] })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
      setNotifOverride(null)
      setNotifLoading(false)
    },
    onError: () => {
      setNotifOverride(null)
      setNotifLoading(false)
    },
  })

  const listingActionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateListingStatus(id, status),
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

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordSuccess('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    },
    onError: (err: unknown) => {
      setPasswordError(getApiErrorMessage(err, 'Failed to change password.'))
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      setShowDeleteAccount(false)
      await logout()
      navigate('/login')
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, 'Failed to delete account.'))
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
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    setCropSource(URL.createObjectURL(file))
    setCropZoom(1)
    setCropOffsetX(0)
    setCropOffsetY(0)
    setIsEditing(true)
    e.target.value = ''
  }, [editImagePreview])

  const removePreview = useCallback(() => {
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    setEditImageFile(null)
    setEditImagePreview(null)
  }, [editImagePreview])

  const closeCropDialog = useCallback(() => {
    if (cropSource) URL.revokeObjectURL(cropSource)
    setCropSource(null)
    setCropZoom(1)
    setCropOffsetX(0)
    setCropOffsetY(0)
    setCropBusy(false)
  }, [cropSource])

  const applyCrop = useCallback(async () => {
    if (!cropSource) return
    setCropBusy(true)
    try {
      const croppedFile = await buildCroppedImageFile(cropSource, cropZoom, cropOffsetX, cropOffsetY)
      const previewUrl = URL.createObjectURL(croppedFile)
      if (editImagePreview) URL.revokeObjectURL(editImagePreview)
      setEditImageFile(croppedFile)
      setEditImagePreview(previewUrl)
      closeCropDialog()
    } catch {
      setCropBusy(false)
    }
  }, [closeCropDialog, cropOffsetX, cropOffsetY, cropSource, cropZoom, editImagePreview])

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
    closeCropDialog()
  }

  const toggleNotif = (type: 'email' | 'push') => {
    setNotifLoading(true)
    const currentEmail = notifOverride?.email ?? profile?.notificationPreferences?.messages ?? true
    const currentPush = notifOverride?.push ?? profile?.notificationPreferences?.listingUpdates ?? true
    const nextEmail = type === 'email' ? !currentEmail : currentEmail
    const nextPush = type === 'push' ? !currentPush : currentPush
    setNotifOverride({ email: nextEmail, push: nextPush })
    notifMutation.mutate({ email: nextEmail, push: nextPush })
  }

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

  if (profileLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (profileError) {
    return (
      <AppShell>
        <div className="py-20 text-center text-error">
          <p>Failed to load profile</p>
          <p className="mt-1 text-sm text-text-muted">
            {getApiErrorMessage(profileError, 'Unable to load profile.')}
          </p>
        </div>
      </AppShell>
    )
  }

  const initials = getInitials(profile?.displayName, profile?.email)
  const profileImageUrl = editImagePreview || profile?.profileImage
  const notifEmail = notifOverride?.email ?? profile?.notificationPreferences?.messages ?? true
  const notifPush = notifOverride?.push ?? profile?.notificationPreferences?.listingUpdates ?? true

  const statusCounts = myListings.reduce<Record<string, number>>((acc, listing) => {
    const key = (listing.status || 'draft') as ListingStatus
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const activeListings = statusCounts.active ?? 0
  const soldListings = statusCounts.sold ?? 0
  const pendingListings = statusCounts.pending ?? 0
  const liveValue = myListings
    .filter((listing) => listing.status === 'active' || listing.status === 'pending')
    .reduce((sum, listing) => sum + listing.price, 0)
  const latestListing = myListings[0]
  const dashboardListingError = getApiErrorMessage(listingsError, 'Unable to load listings.')

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[28px] border border-card-border bg-surface">
          <div className="hero-gradient px-5 py-6 md:px-8 md:py-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-card-border bg-surface text-2xl font-bold text-primary">
                  {profileImageUrl ? (
                    <img src={getAssetUrl(profileImageUrl)} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">Account dashboard</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                    {profile?.displayName || 'PocketTrade seller workspace'}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
                    <span className="truncate">{profile?.email}</span>
                    {profile?.location && (
                      <span className="flex items-center gap-1">
                        <LocationIcon className="h-4 w-4" />
                        {profile.location}
                      </span>
                    )}
                    <span>Member since {formatMemberSince((profile as User & { createdAt?: string })?.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[420px]">
                <MetricCard label="Live listings" value={String(activeListings)} />
                <MetricCard label="Pending review" value={String(pendingListings)} tone="tertiary" />
                <MetricCard label="Sold" value={String(soldListings)} tone="secondary" />
                <MetricCard label="Live value" value={formatMoney(liveValue)} tone="neutral" />
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <SectionCard
              title="Listings workspace"
              subtitle="Track inventory, review state, and next actions from one place."
              icon={<ListingsIcon />}
              action={
                latestListing ? (
                  <div className="rounded-xl bg-background px-3 py-2 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Latest update</p>
                    <p className="text-sm font-medium text-text-primary">{latestListing.brand} {latestListing.model}</p>
                  </div>
                ) : null
              }
            >
              {listingsLoading && (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              )}

              {listingsError && (
                <div className="rounded-2xl border border-card-border bg-background px-5 py-8 text-center">
                  <p className="font-medium text-text-primary">Failed to load listings</p>
                  <p className="mt-1 text-sm text-text-muted">{dashboardListingError}</p>
                  <button
                    onClick={() => refetchListings()}
                    className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!listingsLoading && !listingsError && myListings.length === 0 && (
                <div className="rounded-2xl border border-dashed border-card-border bg-background px-5 py-12 text-center">
                  <p className="text-base font-semibold text-text-primary">No listings yet</p>
                  <p className="mt-1 text-sm text-text-muted">Start selling and the dashboard will track your inventory here.</p>
                  <Link
                    to="/sell"
                    className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    Create first listing
                  </Link>
                </div>
              )}

              {!listingsLoading && !listingsError && myListings.length > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-card-border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Active inventory</p>
                      <p className="mt-2 text-xl font-bold text-text-primary">{activeListings}</p>
                    </div>
                    <div className="rounded-2xl border border-card-border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Awaiting moderation</p>
                      <p className="mt-2 text-xl font-bold text-text-primary">{pendingListings}</p>
                    </div>
                    <div className="rounded-2xl border border-card-border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Listings total</p>
                      <p className="mt-2 text-xl font-bold text-text-primary">{myListings.length}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {myListings.map((listing) => (
                      <MyListingCard
                        key={listing.id}
                        listing={listing}
                        onMarkSold={(itemId) => listingActionMutation.mutate({ id: itemId, status: 'sold' })}
                        onRepublish={(itemId) => listingActionMutation.mutate({ id: itemId, status: 'active' })}
                        onDelete={(itemId) => setDeleteListingId(itemId)}
                        isPending={listingActionMutation.isPending || deleteListingMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
            <SectionCard title="Manage profile" icon={<OverviewIcon />}>
              <div className="space-y-4">
                <div className="border-b border-card-border pb-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-lg font-bold text-primary"
                      aria-label="Change profile photo"
                    >
                      {profileImageUrl ? (
                        <img src={getAssetUrl(profileImageUrl)} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        initials
                      )}
                      <span className="absolute inset-0 bg-primary/0 transition-colors group-hover:bg-primary/10" />
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-text-primary">{profile?.displayName || 'Unnamed account'}</p>
                      <p className="truncate text-sm text-text-secondary">{profile?.email}</p>
                      <p className="mt-1 truncate text-sm text-text-secondary">{profile?.location || 'No location added yet'}</p>
                    </div>
                  </div>
                </div>

                {!isEditing ? (
                  <div className="space-y-3">
                    <button
                      onClick={startEditing}
                      className="w-full rounded-xl border border-card-border bg-background px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-high"
                    >
                      Edit profile
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editImagePreview && (
                      <button
                        type="button"
                        onClick={removePreview}
                        className="rounded-xl border border-card-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-high"
                      >
                        Remove pending photo
                      </button>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Display name</label>
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="Your name"
                        className="w-full rounded-xl border border-input-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Location</label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        placeholder="e.g. London, UK"
                        className="w-full rounded-xl border border-input-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={cancelEditing}
                        className="rounded-xl border border-card-border px-4 py-3 text-sm font-medium text-text-secondary hover:bg-surface-high"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={!editDisplayName.trim() || profileTextMutation.isPending}
                        className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                      >
                        {profileTextMutation.isPending ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Notifications" icon={<OverviewIcon />}>
              <div className="space-y-3">
                <ToggleRow
                  label="Email notifications"
                  hint=""
                  checked={notifEmail}
                  disabled={notifLoading}
                  onToggle={() => toggleNotif('email')}
                />
                <ToggleRow
                  label="Push notifications"
                  hint=""
                  checked={notifPush}
                  disabled={notifLoading}
                  onToggle={() => toggleNotif('push')}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Security"
              icon={<SecurityIcon />}
              action={
                <button
                  type="button"
                  onClick={() => setSecurityOpen((open) => !open)}
                  aria-expanded={securityOpen}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-card-border bg-background text-text-secondary hover:bg-surface-high hover:text-text-primary"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 transition-transform duration-200 ${securityOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              }
            >
              {securityOpen ? (
                <form onSubmit={handleChangePassword} className="space-y-3 animate-panel-in">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full rounded-xl border border-input-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full rounded-xl border border-input-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-input-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {passwordError && <p className="text-xs text-text-secondary">{passwordError}</p>}
                  {passwordSuccess && <p className="text-xs text-primary">{passwordSuccess}</p>}
                  <button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    {passwordMutation.isPending ? 'Updating...' : 'Update password'}
                  </button>
                </form>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Delete acc"
              icon={<SecurityIcon />}
              action={
                <button
                  type="button"
                  onClick={() => setDeleteOpen((open) => !open)}
                  aria-expanded={deleteOpen}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-card-border bg-background text-text-secondary hover:bg-surface-high hover:text-text-primary"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 transition-transform duration-200 ${deleteOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              }
            >
              {deleteOpen ? (
                <div className="animate-panel-in">
                  <button
                    onClick={() => setShowDeleteAccount(true)}
                    className="w-full rounded-xl border border-card-border bg-background px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-high"
                  >
                    Delete account
                  </button>
                </div>
              ) : null}
            </SectionCard>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />

      <CropDialog
        open={!!cropSource}
        imageSrc={cropSource}
        zoom={cropZoom}
        offsetX={cropOffsetX}
        offsetY={cropOffsetY}
        busy={cropBusy}
        onZoomChange={setCropZoom}
        onOffsetXChange={setCropOffsetX}
        onOffsetYChange={setCropOffsetY}
        onCancel={closeCropDialog}
        onApply={() => { void applyCrop() }}
      />

      <ConfirmDialog
        open={!!deleteListingId}
        title="Delete listing?"
        description="This action cannot be undone. The listing will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => deleteListingId && deleteListingMutation.mutate(deleteListingId)}
        onCancel={() => setDeleteListingId(null)}
      />

      <ConfirmDialog
        open={showDeleteAccount}
        title="Delete your account?"
        description="This will permanently delete your account and all your listings. This action cannot be undone."
        confirmLabel="Delete account"
        onConfirm={() => deleteAccountMutation.mutate()}
        onCancel={() => setShowDeleteAccount(false)}
      />
    </AppShell>
  )
}
