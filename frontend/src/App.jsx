import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import MatchSetup from './pages/MatchSetup';
import MatchDetail from './pages/MatchDetail';
import DetectionReview from './pages/DetectionReview';
import EventReview from './pages/EventReview';
import ExportDataset from './pages/ExportDataset';
import AccuracyDashboard from './pages/AccuracyDashboard';
import MatchLineup from './pages/MatchLineup';
import MatchCalibration from './pages/MatchCalibration';
import AdminUsers from './pages/AdminUsers';
import Layout from './components/Layout';

// Protected Route component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-team-a border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Public Route - redirects to dashboard if logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-team-a border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Admin Route - requires admin role
function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-team-a border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role || '').toLowerCase();
  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/new"
        element={
          <ProtectedRoute>
            <MatchSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id"
        element={
          <ProtectedRoute>
            <MatchDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id/detections"
        element={
          <ProtectedRoute>
            <DetectionReview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id/events"
        element={
          <ProtectedRoute>
            <EventReview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id/export"
        element={
          <ProtectedRoute>
            <ExportDataset />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id/accuracy"
        element={
          <ProtectedRoute>
            <AccuracyDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id/lineup"
        element={
          <ProtectedRoute>
            <MatchLineup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id/calibrate"
        element={
          <ProtectedRoute>
            <MatchCalibration />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <Layout>
              <AdminUsers />
            </Layout>
          </AdminRoute>
        }
      />
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
