import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/api/client';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 1. Silent token exchange: fetch access token using httpOnly refresh token cookie
        const refreshRes = await apiClient.post('/auth/refresh');
        const token = refreshRes.data.data.accessToken;

        if (!token) {
          throw new Error('Failed to retrieve access token from credentials rotation');
        }

        // 2. Set token in memory inside apiClient default headers
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // 3. Resolve user details
        const res = await apiClient.get('/auth/me');
        const user = res.data.data;

        // 4. Update Zustand state
        setAuth(user, token);

        toast.success(`Welcome, ${user.name}!`);
        navigate('/dashboard');
      } catch (err: any) {
        console.error('OAuth callback secure rotation error:', err);
        toast.error('Failed to securely synchronize GitHub profile details.');
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-sm text-dark-300">Synchronizing GitHub profile...</p>
      </div>
    </div>
  );
}
