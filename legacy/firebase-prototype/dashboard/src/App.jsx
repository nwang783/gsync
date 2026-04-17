import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';

const Homepage = lazy(() => import('./pages/Homepage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));

function PagePlaceholder({ title = 'loading...' }) {
  return (
    <div className="page-placeholder" style={{ minHeight: '100vh', display: 'flex' }}>
      <div className="placeholder-icon">&gt;_</div>
      <div className="placeholder-title">{title}</div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PagePlaceholder />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PagePlaceholder />}>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
