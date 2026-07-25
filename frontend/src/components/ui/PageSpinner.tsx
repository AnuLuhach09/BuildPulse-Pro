import { Zap } from 'lucide-react';

export const PageSpinner = () => (
  <div className="min-h-screen bg-dark-900 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div className="absolute inset-0 rounded-xl bg-gradient-brand animate-ping opacity-20" />
      </div>
      <p className="text-sm text-dark-300 animate-pulse">Loading BuildPulse...</p>
    </div>
  </div>
);
