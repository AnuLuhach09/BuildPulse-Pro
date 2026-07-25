import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DurationTrendData } from '@/api/analytics.api';

interface BuildDurationTrendProps {
  data: DurationTrendData[];
}

export const BuildDurationTrend = ({ data }: BuildDurationTrendProps) => {
  return (
    <div className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            tickFormatter={(v) => `${Math.floor(v / 60)}m`}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: '#111118',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '11px',
            }}
            formatter={(value: any) => {
              const minutes = Math.floor(value / 60);
              const seconds = value % 60;
              return [`${minutes}m ${seconds}s`, 'Avg Duration'];
            }}
          />
          <Bar
            dataKey="duration"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
