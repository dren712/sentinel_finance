'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, AreaSeries, IChartApi } from 'lightweight-charts';
import {
  PORTFOLIO_1D_DATA,
  PORTFOLIO_1W_DATA,
  PORTFOLIO_1M_DATA,
  ChartDataPoint,
} from '@/lib/sample-chart-data';

interface FinancialChartProps {
  currentValueUsd: number;
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ currentValueUsd }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M'>('1M');

  const getDataForTimeframe = (tf: '1D' | '1W' | '1M'): ChartDataPoint[] => {
    switch (tf) {
      case '1D':
        return PORTFOLIO_1D_DATA;
      case '1W':
        return PORTFOLIO_1W_DATA;
      case '1M':
      default:
        return PORTFOLIO_1M_DATA;
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94A3B8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 38, 56, 0.4)' },
        horzLines: { color: 'rgba(30, 38, 56, 0.4)' },
      },
      crosshair: {
        vertLine: {
          color: '#3B82F6',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: '#3B82F6',
          width: 1,
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: '#1E2638',
      },
      timeScale: {
        borderColor: '#1E2638',
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScale: false,
      handleScroll: false,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(37, 99, 235, 0.28)',
      bottomColor: 'rgba(37, 99, 235, 0.02)',
      lineColor: '#3B82F6',
      lineWidth: 2,
    });

    const data = getDataForTimeframe(timeframe);
    // Cast points for lightweight-charts format
    areaSeries.setData(data as any);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // Responsive resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 240,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when timeframe changes
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    const data = getDataForTimeframe(timeframe);
    seriesRef.current.setData(data as any);
    chartRef.current.timeScale().fitContent();
  }, [timeframe]);

  return (
    <div className="w-full bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-3">
      {/* Chart Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sentinel-border">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-sentinel-text">Portfolio Equity Curve</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                SIMULATED BENCHMARK DATA
              </span>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Current Net Asset Value: <span className="text-white font-mono font-semibold">${currentValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>

        {/* Timeframe Switcher */}
        <div className="flex items-center gap-1 bg-sentinel-surfaceMuted p-1 rounded-lg border border-sentinel-border self-start sm:self-auto">
          {(['1D', '1W', '1M'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-colors ${
                timeframe === tf
                  ? 'bg-sentinel-accent text-white shadow-sm'
                  : 'text-sentinel-textMuted hover:text-white hover:bg-sentinel-surface'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full h-[240px]" />

      {/* Legal Attribution required by TradingView */}
      <div className="flex items-center justify-between text-[10px] text-sentinel-textSubtle pt-2 border-t border-sentinel-border">
        <span>Powered by TradingView Lightweight Charts™</span>
        <span>Solana Devnet Tokenized Equities</span>
      </div>
    </div>
  );
};
