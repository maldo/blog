import { useState, useEffect } from "react";
import type { FC } from "react";
import AmortizationChart from "./AmortizationChart";
import MortgageBreakdownChart from "./MortgageBreakdownChart";
import "../styles/mortgage-calculator.css";

interface AmortizationData {
  year: number;
  interest: number;
  principal: number;
  remainingBalance: number;
}

const MortgageCalculator: FC = () => {
  const [precioInmueble, setPrecioInmueble] = useState<number>(250000);
  const [ahorros, setAhorros] = useState<number>(50000);
  const [plazo, setPlazo] = useState<number>(30);
  const [tipoInteres, setTipoInteres] = useState<number>(3.5);
  const [cuotaMensual, setCuotaMensual] = useState<number | null>(null);
  const [amortizationData, setAmortizationData] = useState<AmortizationData[]>([]);

  useEffect(() => {
    const precioConImpuestos = precioInmueble * 1.11; // Precio + 11% impuestos
    const principal = precioConImpuestos - ahorros;
    if (principal <= 0) {
      setCuotaMensual(0);
      setAmortizationData([]);
      return;
    }

    const tasaInteresMensual = tipoInteres / 100 / 12;
    const numeroPagos = plazo * 12;

    const cuota =
      tasaInteresMensual === 0
        ? principal / numeroPagos
        : (principal *
            tasaInteresMensual *
            Math.pow(1 + tasaInteresMensual, numeroPagos)) /
          (Math.pow(1 + tasaInteresMensual, numeroPagos) - 1);

    setCuotaMensual(cuota);

    let balance = principal;
    const data: AmortizationData[] = [];
    let yearlyInterest = 0;
    let yearlyPrincipal = 0;

    for (let i = 1; i <= numeroPagos; i++) {
      const interesMensual = balance * tasaInteresMensual;
      const principalMensual = cuota - interesMensual;
      balance -= principalMensual;
      yearlyInterest += interesMensual;
      yearlyPrincipal += principalMensual;

      if (i % 12 === 0 || i === numeroPagos) {
        data.push({
          year: Math.ceil(i / 12),
          interest: yearlyInterest,
          principal: yearlyPrincipal,
          remainingBalance: balance < 0 ? 0 : balance,
        });
      }
    }
    setAmortizationData(data);
  }, [precioInmueble, ahorros, plazo, tipoInteres]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <div className="mortgage-calculator">
      <h2>Calculadora de Hipoteca</h2>
      <div className="calculator-layout">
        <div className="inputs-section">
          <div className="input-group">
            <label htmlFor="precio-inmueble">Precio del Inmueble (€)</label>
            <input
              type="number"
              id="precio-inmueble"
              value={precioInmueble}
              onChange={e => setPrecioInmueble(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="ahorros">Ahorros Aportados (€)</label>
            <input
              type="number"
              id="ahorros"
              value={ahorros}
              onChange={e => setAhorros(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="plazo">Plazo (años)</label>
            <input
              type="number"
              id="plazo"
              value={plazo}
              onChange={e => setPlazo(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="tipo-interes">Tipo de Interés Anual (%)</label>
            <input
              type="number"
              id="tipo-interes"
              step="0.01"
              value={tipoInteres}
              onChange={e => setTipoInteres(Number(e.target.value))}
            />
          </div>
          {cuotaMensual !== null && (
            <div className="result">
              <h3>Cuota Mensual Estimada</h3>
              <p>{formatCurrency(cuotaMensual)}</p>
            </div>
          )}
        </div>
        <div className="breakdown-section">
          {cuotaMensual !== null && cuotaMensual > 0 && (
            <MortgageBreakdownChart
              precioInmueble={precioInmueble}
              ahorros={ahorros}
              cuotaMensual={cuotaMensual}
              plazo={plazo}
            />
          )}
        </div>
      </div>
      {amortizationData.length > 0 && <AmortizationChart data={amortizationData} />}
    </div>
  );
};

export default MortgageCalculator;
