import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import { Zap, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/register', form);
      const { user, tokens } = res.data.data;
      setAuth(user, tokens.accessToken);
      toast.success('Account created! Welcome to BuildPulse.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message ?? 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-brand shadow-glow mb-4">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-sm text-dark-300 mt-1">Start monitoring your pipelines today</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {(['name', 'email', 'password'] as const).map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-dark-300 mb-1.5 capitalize">{field}</label>
                <input
                  id={`register-${field}`}
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  required
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'name' ? 'Jane Smith' : field === 'email' ? 'jane@company.com' : '8+ chars, 1 uppercase, 1 number'}
                  className="input-field"
                />
              </div>
            ))}

            <button type="submit" id="register-submit" disabled={isLoading} className="btn-primary w-full justify-center py-2.5">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</> : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-dark-300 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
