import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-primary">404</p>
        <p className="text-lg text-text-secondary mt-2">Page not found</p>
        <Link
          to="/"
          className="inline-block mt-6 bg-primary text-white rounded-xl px-6 py-3 hover:bg-primary-dark transition-all duration-200 active:scale-95"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}