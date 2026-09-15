/**
 * Deterministic benchmark portfolio equity curve data for TradingView Lightweight Charts.
 * Explicitly labeled as simulated reference benchmark data in compliance with rule 2 & 3.
 */

export interface ChartDataPoint {
  time: string; // YYYY-MM-DD
  value: number;
}

export const PORTFOLIO_1M_DATA: ChartDataPoint[] = [
  { time: '2026-08-15', value: 96420.00 },
  { time: '2026-08-16', value: 96890.50 },
  { time: '2026-08-17', value: 96310.20 },
  { time: '2026-08-18', value: 97150.00 },
  { time: '2026-08-19', value: 97620.80 },
  { time: '2026-08-20', value: 97410.10 },
  { time: '2026-08-21', value: 98100.40 },
  { time: '2026-08-22', value: 98350.00 },
  { time: '2026-08-23', value: 97940.20 },
  { time: '2026-08-24', value: 98450.60 },
  { time: '2026-08-25', value: 98900.00 },
  { time: '2026-08-26', value: 98650.30 },
  { time: '2026-08-27', value: 99120.90 },
  { time: '2026-08-28', value: 99540.00 },
  { time: '2026-08-29', value: 99210.50 },
  { time: '2026-08-30', value: 99680.00 },
  { time: '2026-08-31', value: 99450.20 },
  { time: '2026-09-01', value: 99820.70 },
  { time: '2026-09-02', value: 100150.00 },
  { time: '2026-09-03', value: 99790.40 },
  { time: '2026-09-04', value: 100340.10 },
  { time: '2026-09-05', value: 100520.00 },
  { time: '2026-09-06', value: 100280.90 },
  { time: '2026-09-07', value: 100650.30 },
  { time: '2026-09-08', value: 100920.00 },
  { time: '2026-09-09', value: 100410.50 },
  { time: '2026-09-10', value: 100850.20 },
  { time: '2026-09-11', value: 101240.00 },
  { time: '2026-09-12', value: 100980.80 },
  { time: '2026-09-13', value: 101420.50 },
  { time: '2026-09-14', value: 101150.00 },
  { time: '2026-09-15', value: 101420.00 },
];

export const PORTFOLIO_1W_DATA: ChartDataPoint[] = PORTFOLIO_1M_DATA.slice(-7);
export const PORTFOLIO_1D_DATA: ChartDataPoint[] = PORTFOLIO_1M_DATA.slice(-2);
