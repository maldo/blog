import type { FC } from "react";

interface MortgageBreakdownChartProps {
  precioInmueble: number;
  ahorros: number;
  cuotaMensual: number;
  plazo: number;
}

const MortgageBreakdownChart: FC<MortgageBreakdownChartProps> = ({
  precioInmueble,
  ahorros,
  cuotaMensual,
  plazo,
}) => {
  const impuestosYGastos = precioInmueble * 0.10714; // 26.785 / 250.000 = 0.10714 
  const principal = precioInmueble + impuestosYGastos - ahorros;
  const totalPagadoHipoteca = cuotaMensual * plazo * 12;
  const totalIntereses = totalPagadoHipoteca - principal;
  
  const costoTotalCompra = precioInmueble + impuestosYGastos;
  const totalDesembolsoInicial = ahorros;
  const costoTotalFinal = totalPagadoHipoteca + totalDesembolsoInicial;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const maxValueCompra = costoTotalCompra;
  const maxValueHipoteca = Math.max(ahorros, principal, totalIntereses);

  return (
    <div className="breakdown-chart">
      <h3>Desglose de Costes</h3>
      
      {/* Sección 1: Coste Total de Compra */}
      <div className="chart-section">
        <h4>Coste Total de Compra</h4>
        <div className="chart-container">
          <div className="bar-item">
            <div className="bar-label">Total ({formatCurrency(costoTotalCompra)})</div>
            <div className="bar stacked-bar">
              <div
                className="bar-fill precio-inmueble"
                style={{ width: `${(precioInmueble / costoTotalCompra) * 100}%` }}
              ></div>
              <div
                className="bar-fill impuestos"
                style={{ width: `${(impuestosYGastos / costoTotalCompra) * 100}%` }}
              ></div>
            </div>
            <div className="bar-breakdown">
              <span>Precio Inmueble: {formatCurrency(precioInmueble)}</span>
              <span>Impuestos/Gastos: {formatCurrency(impuestosYGastos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2: Financiación del Inmueble */}
      <div className="chart-section">
        <h4>Financiación del Inmueble</h4>
        <div className="chart-container">
          <div className="bar-item">
            <div className="bar-label">Ahorros Aportados (Entrada)</div>
            <div className="bar">
              <div
                className="bar-fill ahorros"
                style={{ width: `${(ahorros / precioInmueble) * 100}%` }}
              ></div>
            </div>
            <div className="bar-value">{formatCurrency(ahorros)}</div>
          </div>
          
          <div className="bar-item">
            <div className="bar-label">Capital Prestado</div>
            <div className="bar">
              <div
                className="bar-fill principal"
                style={{ width: `${(principal / precioInmueble) * 100}%` }}
              ></div>
            </div>
            <div className="bar-value">{formatCurrency(principal)}</div>
          </div>
          
          <div className="bar-item">
            <div className="bar-label">Intereses Totales</div>
            <div className="bar">
              <div
                className="bar-fill intereses"
                style={{ width: `${(totalIntereses / precioInmueble) * 100}%` }}
              ></div>
            </div>
            <div className="bar-value">{formatCurrency(totalIntereses)}</div>
          </div>
        </div>
        
        <div className="financing-summary">
          <div><strong>Importe hipoteca:</strong> {formatCurrency(principal)}</div>
          <div><strong>Intereses totales:</strong> {formatCurrency(totalIntereses)}</div>
          <div><strong>Total a pagar al banco:</strong> {formatCurrency(totalPagadoHipoteca)}</div>
        </div>
      </div>
      
      <div className="total-summary">
        <strong>Coste Total Final: {formatCurrency(costoTotalFinal)}</strong>
        <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.8 }}>
          Desembolso inicial: {formatCurrency(totalDesembolsoInicial)} + Pagos hipoteca: {formatCurrency(totalPagadoHipoteca)}
        </div>
      </div>
    </div>
  );
};

export default MortgageBreakdownChart;