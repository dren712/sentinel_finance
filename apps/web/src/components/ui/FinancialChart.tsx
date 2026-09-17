'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, AreaSeries, IChartApi } from 'lightweight-charts';
import {
  PORTFOLIO_1D_DATA,
  PORTFOLIO_1W_DATA,
  PORTFOLIO_1M_DATA,
  PORTFOLIO_3M_DATA,
  PORTFOLIO_ALL_DATA,
  getScaledChartData,
  ChartDataPoint,
} from '@/lib/sample-chart-data';

interface FinancialChartProps {
  currentValueUsd: number;
}

export type TimeframeOption = '1D' | '1W' | '1M' | '3M' | 'ALL';

export const FinancialChart: React.FC<FinancialChartProps> = ({ currentValueUsd }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<TimeframeOption>('1M');

  const getDataForTimeframe = (tf: TimeframeOption): ChartDataPoint[] => {
    let raw: ChartDataPoint[];
    switch (tf) {
      case '1D':
        raw = PORTFOLIO_1D_DATA;
        break;
      case '1W':
        raw = PORTFOLIO_1W_DATA;
        break;
      case '3M':
        raw = PORTFOLIO_3M_DATA;
        break;
      case 'ALL':
        raw = PORTFOLIO_ALL_DATA;
        break;
      case '1M':
      default:
        raw = PORTFOLIO_1M_DATA;
        break;
    }
    return getScaledChartData(raw, currentValueUsd);
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748B',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.3)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.3)' },
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
        borderColor: '#1E293B',
      },
      timeScale: {
        borderColor: '#1E293B',
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScale: false,
      handleScroll: false,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(37, 99, 235, 0.22)',
      bottomColor: 'rgba(37, 99, 235, 0.01)',
      lineColor: '#3B82F6',
      lineWidth: 2,
    });

    const data = getDataForTimeframe(timeframe);
    areaSeries.setData(data as any);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 250,
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

  // Update data when timeframe or currentValueUsd changes
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    const data = getDataForTimeframe(timeframe);
    seriesRef.current.setData(data as any);
    chartRef.current.timeScale().fitContent();
  }, [timeframe, currentValueUsd]);

  return (
    <div className="w-full bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
      {/* Portfolio Value & Timeframe Controls */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-sentinel-border/70">
        <div>
          <span className="text-xs font-semibold text-sentinel-textSubtle tracking-wider uppercase">
            Portfolio Value
          </span>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white mt-1">
            ${currentValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Timeframe Switcher [ 1D ] [ 1W ] [ 1M ] [ 3M ] [ ALL ] */}
        <div className="flex items-center gap-1 bg-sentinel-surfaceMuted p-1 rounded-lg border border-sentinel-border">
          {(['1D', '1W', '1M', '3M', 'ALL'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded-md transition-all cursor-pointer ${
                timeframe === tf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-sentinel-textMuted hover:text-white hover:bg-sentinel-surface'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full h-[250px]" />
    </div>
  );
};
