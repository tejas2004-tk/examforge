import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { roleHome } from '../routes/index.jsx';
import { useAuthStore } from '../store/authStore.js';

export function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(roleHome[user.role] ?? '/', { replace: true });
    } else if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  return null;
}
