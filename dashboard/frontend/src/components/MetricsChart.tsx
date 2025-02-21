
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { name: "Mar 15", responseTime: 2.1, tokenCount: 150, cost: 0.02 },
  { name: "Mar 16", responseTime: 1.8, tokenCount: 200, cost: 0.03 },
  { name: "Mar 17", responseTime: 2.3, tokenCount: 180, cost: 0.025 },
  { name: "Mar 18", responseTime: 1.9, tokenCount: 220, cost: 0.035 },
  { name: "Mar 19", responseTime: 2.0, tokenCount: 190, cost: 0.028 },
  { name: "Mar 20", responseTime: 1.7, tokenCount: 210, cost: 0.032 },
];

export const MetricsChart = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 animate-fade-in">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">LLM Metrics</h2>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
              }}
            />
            <Line
              type="monotone"
              name="Response Time (s)"
              dataKey="responseTime"
              stroke="#6d28d9"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              name="Token Count"
              dataKey="tokenCount"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              name="Cost ($)"
              dataKey="cost"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
