import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import LoadingSpinner from './LoadingSpinner.jsx';

export default function ProtectedRoute({ children }) {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!isInitialized) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-950">
        <LoadingSpinner />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
