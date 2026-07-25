import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DeployFrequencyData } from '@/api/analytics.api';

interface DeploymentFrequencyProps {
  data: DeployFrequencyData[];
}

export const DeploymentFrequency = ({ data }: DeploymentFrequencyProps) => {
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
            allowDecimals={false}
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
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: '10px', color: '#5a5a7a' }}
          />
          <Bar dataKey="production" name="Production" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="staging" name="Staging" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
          <Bar dataKey="preview" name="Preview" stackId="a" fill="#3d3d5a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
