import { Navigate } from 'react-router-dom';
import { roleHome } from '../routes/index.jsx';
import { useAuthStore } from '../store/authStore.js';
import { LandingPage } from './LandingPage.jsx';

/**
 * The root path serves two audiences: a signed-in user belongs on their own
 * dashboard, while a visitor gets the public page. Redirecting during render
 * rather than in an effect avoids the blank frame the effect version showed
 * before the store had rehydrated.
 */
export function HomePage() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user?.role) {
    return <Navigate to={roleHome[user.role] ?? '/login'} replace />;
  }

  return <LandingPage />;
}
