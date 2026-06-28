import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import AppShell from '../components/AppShell'
import { api } from '../lib/api'

interface FormState {
  brand: string
  model: string
  price: string
  condition: string
  storage: string
  colour: string
  description: string
  location: string
}

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'] as const
const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB'] as const

const initialForm: FormState = {
  brand: '',
  model: '',
  price: '',
  condition: '',
  storage: '',
  colour: '',
  description: '',
  location: '',
}

interface ValidationErrors {
  [key: string]: string
}

function validateForm(form: FormState, images: File[]): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!form.brand.trim()) {
    errors.brand = 'Brand is required'
  }
  if (!form.model.trim()) {
    errors.model = 'Model is required'
  }
  if (!form.condition) {
    errors.condition = 'Condition is required'
  }
  if (!form.price.trim()) {
    errors.price = 'Price is required'
  } else {
    const priceNum = parseFloat(form.price)
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Price must be greater than 0'
    }
  }

  if (images.length > 5) {
    errors.images = 'You can upload a maximum of 5 images'
  }

  return errors
}

export default function CreateListing() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(initialForm)
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitError, setSubmitError] = useState('')

  const updateField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      if (errors[field]) {
        setErrors((prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [field]: _, ...rest } = prev
          return rest
        })
      }
    },
    [errors]
  )

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      const combined = [...images, ...files].slice(0, 5)
      const removedPreviews = previews.slice(combined.length)
      removedPreviews.forEach((url) => URL.revokeObjectURL(url))

      const newPreviews = combined.map((file) => URL.createObjectURL(file))
      setImages(combined)
      setPreviews(newPreviews)

      if (combined.length > 0 && errors.images) {
        setErrors((prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { images: _, ...rest } = prev
          return rest
        })
      }
      if (combined.length === 5) {
        const errs = validateForm(form, combined)
        if (errs.images) {
          setErrors((prev) => ({ ...prev, images: errs.images }))
        }
      }

      e.target.value = ''
    },
    [images, previews, form, errors.images]
  )

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index)
      URL.revokeObjectURL(previews[index])
      const newPreviews = newImages.map((file) => URL.createObjectURL(file))
      setImages(newImages)
      setPreviews(newPreviews)
    },
    [images, previews]
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('brand', form.brand.trim())
      formData.append('model', form.model.trim())
      formData.append('price', form.price)
      if (form.condition) formData.append('condition', form.condition)
      if (form.storage) formData.append('storage', form.storage)
      if (form.colour.trim()) formData.append('colour', form.colour.trim())
      if (form.description.trim()) formData.append('description', form.description.trim())
      if (form.location.trim()) formData.append('location', form.location.trim())
      images.forEach((img) => formData.append('images', img))

      const res = await api.post<{ id: number }>('/listings', formData, {
        headers: { 'Content-Type': undefined },
      })
      return res.data
    },
    onSuccess: (data) => {
      navigate(`/listing/${data.id}`)
    },
    onError: (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
      setSubmitError(
        err?.response?.data?.message || 'Failed to create listing. Please try again.'
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    const validationErrors = validateForm(form, images)

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    mutation.mutate()
  }

  const inputClass = (field: keyof FormState) =>
    `w-full rounded-xl border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
      errors[field]
        ? 'border-error focus:border-error focus:ring-error/20'
        : 'border-input-border'
    }`

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-6 md:py-8 max-w-3xl mx-auto">
        <div className="bg-surface rounded-2xl border border-card-border p-6 md:p-8 shadow-sm">
          <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-1">
            Sell your phone
          </h1>
          <p className="text-text-secondary text-sm mb-6">
            Fill in the details below to list your device.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Photos{' '}
                <span className="text-text-muted font-normal">
                  ({images.length}/5)
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                {previews.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 rounded-xl border border-card-border overflow-hidden flex-shrink-0"
                  >
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-foreground/70 text-white rounded-full text-xs flex items-center justify-center hover:bg-foreground transition-colors"
                      aria-label={`Remove image ${idx + 1}`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="w-20 h-20 rounded-xl border border-dashed border-input-border bg-surface-high flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-surface transition-colors flex-shrink-0">
                    <span className="text-2xl text-text-muted leading-none">+</span>
                    <span className="text-[10px] text-text-muted mt-0.5">Add photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>
              {errors.images && (
                <p className="text-error text-xs mt-1.5">{errors.images}</p>
              )}
            </div>

            {/* 2-column grid on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Brand <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => updateField('brand', e.target.value)}
                  placeholder="e.g. Apple"
                  className={inputClass('brand')}
                />
                {errors.brand && (
                  <p className="text-error text-xs mt-1">{errors.brand}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Model <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  placeholder="e.g. iPhone 15 Pro"
                  className={inputClass('model')}
                />
                {errors.model && (
                  <p className="text-error text-xs mt-1">{errors.model}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Price <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="0.00"
                  className={inputClass('price')}
                />
                {errors.price && (
                  <p className="text-error text-xs mt-1">{errors.price}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Condition <span className="text-error">*</span>
                </label>
                <select
                  value={form.condition}
                  onChange={(e) => updateField('condition', e.target.value)}
                  className={inputClass('condition')}
                >
                  <option value="" disabled>
                    Select condition
                  </option>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {errors.condition && (
                  <p className="text-error text-xs mt-1">{errors.condition}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Storage
                </label>
                <select
                  value={form.storage}
                  onChange={(e) => updateField('storage', e.target.value)}
                  className={`${inputClass('storage')} appearance-none`}
                >
                  <option value="">Select storage</option>
                  {STORAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Colour
                </label>
                <input
                  type="text"
                  value={form.colour}
                  onChange={(e) => updateField('colour', e.target.value)}
                  placeholder="e.g. Space Black"
                  className={inputClass('colour')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="e.g. London, UK"
                  className={inputClass('location')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                placeholder="Describe the condition, accessories included, etc."
                className={`${inputClass('description')} resize-none`}
              />
            </div>

            {submitError && (
              <p className="text-error text-sm bg-error/5 border border-error/20 rounded-xl px-4 py-3">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-xl bg-primary text-white font-medium py-3 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating listing…
                </>
              ) : (
                'Create listing'
              )}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}
