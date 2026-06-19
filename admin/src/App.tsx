import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

const Activity = lazy(() => import('./pages/Activity').then((module) => ({ default: module.Activity })));
const Analytics = lazy(() => import('./pages/Analytics').then((module) => ({ default: module.Analytics })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Listings = lazy(() => import('./pages/Listings').then((module) => ({ default: module.Listings })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));
const Users = lazy(() => import('./pages/Users').then((module) => ({ default: module.Users })));

function PageFallback() {
  return (
    <div className="space-y-4" aria-label="Loading page">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
    </div>
  );
}

function protectedPage(child: React.ReactNode) {
  return (
    <ProtectedRoute>
      <Layout>{child}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={protectedPage(<Dashboard />)} />
          <Route path="/listings" element={protectedPage(<Listings />)} />
          <Route path="/users" element={protectedPage(<Users />)} />
          <Route path="/reports" element={protectedPage(<Reports />)} />
          <Route path="/analytics" element={protectedPage(<Analytics />)} />
          <Route path="/activity" element={protectedPage(<Activity />)} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
