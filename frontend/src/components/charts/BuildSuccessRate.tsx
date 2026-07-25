import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SuccessRateData } from '@/api/analytics.api';

interface BuildSuccessRateProps {
  data: SuccessRateData[];
}

export const BuildSuccessRate = ({ data }: BuildSuccessRateProps) => {
  return (
    <div className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#232334" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#5a5a7a"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="#5a5a7a"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: '#111118',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '11px',
            }}
            formatter={(value: any) => [`${value}%`, 'Success Rate']}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="#6366f1"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRate)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
