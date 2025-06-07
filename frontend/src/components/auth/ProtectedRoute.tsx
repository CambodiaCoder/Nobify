import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'USER' | 'ADMIN' | 'MODERATOR';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Store the attempted URL to redirect back after login
        if (location.pathname) {
          sessionStorage.setItem('redirectAfterLogin', location.pathname);
        }
        // Use the login page - Next.js will handle the route group resolution
        navigate('/login', { replace: true });
        return;
      }

      if (requiredRole && user?.role !== requiredRole) {
        // Redirect to dashboard if user doesn't have required role
        navigate('/dashboard', { replace: true });
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, navigate, location, requiredRole]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If authenticated and has required role (if specified), render children
  if (isAuthenticated && (!requiredRole || user?.role === requiredRole)) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}