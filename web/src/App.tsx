import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAdminShortcut } from './hooks/useAdminShortcut'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyOTP from './pages/VerifyOTP'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import Search from './pages/Search'
import CreateListing from './pages/CreateListing'
import ListingDetails from './pages/ListingDetails'
import Favorites from './pages/Favorites'
import Messages from './pages/Messages'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

function AdminShortcutListener() {
  useAdminShortcut()
  return null
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <div key={location.pathname} className="min-h-dvh text-foreground animate-page-in">
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/sell" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
        <Route path="/listing/:id" element={<ListingDetails />} />
        <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/chat/:id" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AdminShortcutListener />
      <AnimatedRoutes />
    </AuthProvider>
  )
}

export default App
