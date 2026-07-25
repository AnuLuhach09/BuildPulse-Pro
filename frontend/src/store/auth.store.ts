import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  githubLogin?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  // Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

/**
 * Auth Store (Zustand)
 *
 * WHY Zustand over Context:
 * - No prop drilling through component tree
 * - Components subscribe to only the slice they need (no unnecessary re-renders)
 * - persist middleware syncs to localStorage automatically
 * - Can be read outside of React (in axios interceptors) via .getState()
 *
 * IMPORTANT: We only persist the user object, NOT the accessToken.
 * The access token lives in memory (cleared on page refresh).
 * On refresh, the silent-refresh interceptor will re-issue it using
 * the httpOnly cookie refresh token.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'buildpulse-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist user, not the token (security)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
