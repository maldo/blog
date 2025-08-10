
import type { FC } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AmortizationData {
  year: number;
  interest: number;
  principal: number;
  remainingBalance: number;
}

interface AmortizationChartProps {
  data: AmortizationData[];
}

const AmortizationChart: FC<AmortizationChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="amortization-chart">
      <h3>Gráfico de Amortización</h3>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" label={{ value: 'Año', position: 'insideBottomRight', offset: -5 }} />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="remainingBalance"
            stroke="#8884d8"
            name="Capital Pendiente"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="principal"
            stroke="#82ca9d"
            name="Capital Amortizado"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="interest"
            stroke="#ffc658"
            name="Intereses Pagados"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AmortizationChart;
