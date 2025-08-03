import { useState, useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { Chart as ChartType } from "chart.js/auto";
import "@styles/compound-interest.css";

interface YearData {
  year: number;
  amount: number;
  interestThisYear: number;
  totalContributions: number;
}

const CompoundInterestCalculator = () => {
  const [principal, setPrincipal] = useState(10000);
  const [rate, setRate] = useState(5);
  const [years, setYears] = useState(10);
  const [frequency, setFrequency] = useState(12);
  const [contribution, setContribution] = useState(500);

  const [finalAmount, setFinalAmount] = useState(0);
  const [totalContrib, setTotalContrib] = useState(0);
  const [interestEarned, setInterestEarned] = useState(0);
  const [growthMultiple, setGrowthMultiple] = useState(0);
  const [breakdown, setBreakdown] = useState<YearData[]>([]);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartType | null>(null);

  useEffect(() => {
    const computeData = () => {
      const P = principal;
      const r = rate / 100;
      const t = years;
      const n = frequency;
      const PMT = contribution;
      const m = 12; // Monthly contributions

      const data: YearData[] = [];
      let lastYearAmount = P;

      for (let year = 0; year <= t; year++) {
        const lumpSumFV = P * Math.pow(1 + r / n, n * year);

        let annuityFV = 0;
        if (PMT > 0 && r > 0) {
          const annuityDenominator = Math.pow(1 + r / n, n / m) - 1;
          if (annuityDenominator > 0) {
            const annuityNumerator = Math.pow(1 + r / n, n * year) - 1;
            annuityFV = PMT * (annuityNumerator / annuityDenominator);
          } else {
            annuityFV = PMT * m * year;
          }
        } else if (PMT > 0 && r === 0) {
          annuityFV = PMT * m * year;
        }

        const amount = lumpSumFV + annuityFV;
        const totalContributionsWithPrincipal = P + PMT * m * year;

        let interestThisYear = 0;
        if (year > 0) {
          const annualContribution = PMT * m;
          interestThisYear = amount - lastYearAmount - annualContribution;
        }

        data.push({
          year,
          amount,
          interestThisYear,
          totalContributions: totalContributionsWithPrincipal,
        });

        lastYearAmount = amount;
      }

      const totalContribOnly = PMT * m * t;
      const finalVal = data.at(-1)?.amount ?? 0;

      setFinalAmount(finalVal);
      const totalContributionsVal = totalContribOnly + P;
      setTotalContrib(totalContributionsVal);
      setInterestEarned(finalVal - totalContributionsVal);
      setGrowthMultiple(finalVal / totalContributionsVal);
      setBreakdown(data);
    };

    computeData();
  }, [principal, rate, years, frequency, contribution]);

  useEffect(() => {
    if (!chartRef.current || breakdown.length === 0) return;

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: breakdown.map(d => d.year),
        datasets: [
          {
            label: "Portfolio Value",
            data: breakdown.map(d => d.amount),
            tension: 0.25,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c: any) =>
                c.parsed.y.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }),
            },
          },
        },
        scales: {
          x: { title: { display: true, text: "Year" } },
          y: {
            title: { display: true, text: "Value (USD)" },
            ticks: {
              callback: (v: string | number) =>
                "$" + (Number(v) / 1000).toFixed(0) + "k",
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [breakdown]);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Compound Interest Calculator</h1>
        <p className="page-subtitle">
          See how your money grows over time with the power of compound interest
        </p>
      </header>

      <div className="container">
        <form id="calc" className="card">
          <h2>Investment Details</h2>
          <div className="form-group">
            <label htmlFor="principal">
              Initial Investment ($)
              <span
                className="info"
                title="The lump‑sum amount you invest today"
              >
                ℹ️
              </span>
            </label>
            <input
              id="principal"
              type="number"
              step="0.01"
              value={principal}
              min="0"
              onChange={e => setPrincipal(parseFloat(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="rate">
              Annual Interest Rate (%)
              <span
                className="info"
                title="Nominal interest rate before compounding"
              >
                ℹ️
              </span>
            </label>
            <input
              id="rate"
              type="number"
              step="0.01"
              value={rate}
              min="0"
              onChange={e => setRate(parseFloat(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="years">
              Time Period (years)
              <span
                className="info"
                title="How long you plan to let the investment grow"
              >
                ℹ️
              </span>
            </label>
            <input
              id="years"
              type="number"
              step="1"
              value={years}
              min="1"
              onChange={e => setYears(parseInt(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="frequency">
              Compounding Frequency
              <span
                className="info"
                title="How many times per year the interest is added to the principal"
              >
                ℹ️
              </span>
            </label>
            <select
              id="frequency"
              value={frequency}
              onChange={e => setFrequency(parseInt(e.target.value))}
            >
              <option value="1">Annually</option>
              <option value="4">Quarterly</option>
              <option value="12">Monthly</option>
              <option value="365">Daily</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="contribution">
              Monthly Contribution ($)
              <span
                className="info"
                title="Optional extra amount you add each month"
              >
                ℹ️
              </span>
            </label>
            <input
              id="contribution"
              type="number"
              step="0.01"
              value={contribution}
              min="0"
              onChange={e => setContribution(parseFloat(e.target.value))}
            />
          </div>
        </form>

        <div className="card">
          <h2 className="sr-only">Results</h2>
          <div className="stats">
            <div className="stat">
              <h3>Final Amount</h3>
              <p id="finalAmount">
                {finalAmount.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
            </div>
            <div className="stat">
              <h3>Total Contributions</h3>
              <p id="totalContrib">
                {totalContrib.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
            </div>
            <div className="stat">
              <h3>Interest Earned</h3>
              <p id="interestEarned">
                {interestEarned.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
            </div>
            <div className="stat">
              <h3>Growth Multiple</h3>
              <p id="growthMultiple">{growthMultiple.toFixed(4)}x</p>
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <canvas ref={chartRef} height="100"></canvas>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-2xl font-semibold">
            Year-by-Year Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table id="breakdown-table" className="w-full text-left">
              <thead>
                <tr>
                  <th className="p-4">Year</th>
                  <th className="p-4">Value</th>
                  <th className="p-4">Interest Earned</th>
                  <th className="p-4">Total Contributions</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map(d =>
                  d.year === 0 ? null : (
                    <tr key={d.year}>
                      <td className="p-4">{d.year}</td>
                      <td className="p-4">
                        {d.amount.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="p-4">
                        {d.interestThisYear.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                      <td className="p-4">
                        {d.totalContributions.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompoundInterestCalculator;
