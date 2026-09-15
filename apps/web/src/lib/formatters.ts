/**
 * Centralized formatting utilities for Sentinel Finance
 * Ensures uniform tabular-numeric and currency representation across the entire UI.
 */

export function formatCurrency(
  value: number,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSign?: boolean;
  }
): string {
  const maxDecimals = options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 2;
  const minDecimals =
    options?.minimumFractionDigits !== undefined
      ? Math.min(options.minimumFractionDigits, maxDecimals)
      : Math.min(2, maxDecimals);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(Math.abs(value));

  if (options?.showSign && value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

export function formatPercent(
  pct: number,
  options?: {
    decimals?: number;
    showSign?: boolean;
  }
): string {
  const decimals = options?.decimals ?? 2;
  const sign = options?.showSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatBpsRaw(bps: number): string {
  return `${bps.toLocaleString('en-US')} bps`;
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatSignature(sig: string, chars = 6): string {
  if (!sig) return '';
  if (sig.length <= chars * 2 + 3) return sig;
  return `${sig.slice(0, chars)}...${sig.slice(-chars)}`;
}

export function formatTimeAgo(timestamp: number): string {
  const elapsed = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsed < 5) return 'Just now';
  if (elapsed < 60) return `${elapsed}s ago`;
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}
