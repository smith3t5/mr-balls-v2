// Shared utility functions for M.R. B.A.L.L.S. 2.0

/**
 * Calculate parlay odds from individual American odds
 */
export function calculateParlayOdds(americanOdds: number[]): number {
  const decimalOdds = americanOdds.map((odds) => {
    if (odds > 0) {
      return 1 + odds / 100;
    } else {
      return 1 + 100 / Math.abs(odds);
    }
  });

  const parlayDecimal = decimalOdds.reduce((acc, odds) => acc * odds, 1);

  // Convert back to American
  if (parlayDecimal >= 2) {
    return Math.round((parlayDecimal - 1) * 100);
  } else {
    return -Math.round(100 / (parlayDecimal - 1));
  }
}

/**
 * Convert American odds to implied probability
 */
export function oddsToImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  } else {
    return 1 + 100 / Math.abs(americanOdds);
  }
}

/**
 * Format currency without decimals
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format odds with proper +/- sign
 */
export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/**
 * Calculate potential return from stake and odds
 */
export function calculatePotentialReturn(stake: number, americanOdds: number): number {
  const decimal = americanToDecimal(americanOdds);
  return stake * decimal;
}

/**
 * Calculate units from dollar amount
 */
export function dollarsToUnits(dollars: number, unitSize: number): number {
  return dollars / unitSize;
}

/**
 * Determine parlay result based on leg statuses
 * Returns: 'won' | 'lost' | 'push' | 'pending'
 */
export function calculateParlayResult(
  legStatuses: ('won' | 'lost' | 'push' | 'pending')[]
): 'won' | 'lost' | 'push' | 'pending' {
  // If any leg is pending, parlay is pending
  if (legStatuses.some(status => status === 'pending')) {
    return 'pending';
  }

  // If any leg lost, parlay is lost
  if (legStatuses.some(status => status === 'lost')) {
    return 'lost';
  }

  // If all legs won, parlay is won
  if (legStatuses.every(status => status === 'won')) {
    return 'won';
  }

  // If all legs are won or push (with at least one push), it's a push
  if (legStatuses.every(status => status === 'won' || status === 'push')) {
    return 'push';
  }

  // Default to pending if we can't determine
  return 'pending';
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
