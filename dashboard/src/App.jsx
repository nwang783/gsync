import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Homepage from './pages/Homepage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-placeholder" style={{ minHeight: '100vh', display: 'flex' }}>
        <div className="placeholder-icon">&gt;_</div>
        <div className="placeholder-title">loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
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
  );
}
