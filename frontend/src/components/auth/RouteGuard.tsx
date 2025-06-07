import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

type UserRole = 'USER' | 'ADMIN' | 'MODERATOR';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallbackPath?: string;
}

/**
 * RouteGuard component that protects routes based on authentication and role requirements
 * 
 * @param children - The content to render if authorized
 * @param requiredRoles - Optional array of roles that are allowed to access the route
 * @param fallbackPath - Optional path to redirect to if unauthorized (defaults to /dashboard or /login)
 */
export default function RouteGuard({ 
  children, 
  requiredRoles = [], 
  fallbackPath 
}: RouteGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Authentication check function
    const authCheck = () => {
      // If still loading auth state, don't make any decisions yet
      if (isLoading) return;

      // If not authenticated, redirect to login
      if (!isAuthenticated) {
        setAuthorized(false);
        // Store the current path for redirect after login
        if (location.pathname) {
          sessionStorage.setItem('redirectAfterLogin', location.pathname);
        }
        // Redirect to login
        navigate(fallbackPath || '/login', { replace: true });
        return;
      }

      // If role check is required and user doesn't have any of the required roles
      if (requiredRoles.length > 0 && user && !requiredRoles.includes(user.role)) {
        setAuthorized(false);
        toast.error('You do not have permission to access this page');
        // Redirect to fallback or dashboard
        navigate(fallbackPath || '/dashboard', { replace: true });
        return;
      }

      // If we get here, user is authorized
      setAuthorized(true);
    };

    // Run the auth check
    authCheck();

    // Set up an interval to periodically check authentication status
    // This helps catch session timeouts
    const authCheckInterval = setInterval(authCheck, 60000); // Check every minute

    // Clean up interval on unmount
    return () => clearInterval(authCheckInterval);
  }, [isLoading, isAuthenticated, user, navigate, location, requiredRoles, fallbackPath]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If authorized, render children
  return authorized ? <>{children}</> : null;
}