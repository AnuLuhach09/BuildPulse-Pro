import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/api/client';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, Github, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      if (error === 'oauth_not_configured') {
        toast.error(
          'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the backend .env file.',
          { duration: 5000 }
        );
      } else if (error === 'oauth_failed') {
        toast.error('GitHub authentication failed. Please try again.');
      }
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', form);
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message ?? 'Login failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHub = () => {
    window.location.href = '/api/v1/auth/github';
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-brand shadow-glow mb-4">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-dark-300 mt-1">Sign in to BuildPulse Pro</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {/* GitHub OAuth */}
          <button
            onClick={handleGitHub}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-[#24292e] hover:bg-[#2f363d] border border-white/10 text-white text-sm font-medium transition-all mb-6"
          >
            <Github className="w-4 h-4" />
            Continue with GitHub
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-dark-700 px-3 text-xs text-dark-300">or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Email address</label>
              <input
                type="email"
                id="login-email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-dark-300 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
