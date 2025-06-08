# Enhanced Portfolio Performance Metrics

## Overview

This document describes the enhanced portfolio performance metrics implementation that provides comprehensive analysis of portfolio performance, risk assessment, and benchmark comparisons.

## Features Implemented

### 1. Time-Based Performance Metrics
- **1D, 7D, 30D, 90D, 1Y, YTD returns**: Calculate portfolio performance over different time periods
- **Historical value estimation**: Reconstruct portfolio value at any historical date using transaction history
- **Absolute and percentage returns**: Both dollar amounts and percentage changes

### 2. Advanced Portfolio Metrics
- **Sharpe Ratio**: Risk-adjusted return metric (assuming 0% risk-free rate for crypto)
- **Volatility**: Annualized portfolio volatility based on daily returns
- **Maximum Drawdown**: Largest peak-to-trough decline and its time period
- **Win Rate**: Percentage of profitable trading days
- **Best/Worst Day**: Highest and lowest single-day returns
- **Average Return**: Annualized average daily return

### 3. Risk Metrics
- **Value at Risk (VaR)**: 95% and 99% confidence levels
- **Conditional Value at Risk (CVaR)**: Expected loss beyond VaR threshold
- **Downside Deviation**: Volatility of negative returns only
- **Sortino Ratio**: Risk-adjusted return using downside deviation

### 4. Benchmark Comparisons
- **Portfolio vs BTC/ETH**: Compare portfolio performance against major cryptocurrencies
- **Alpha and Beta**: Risk-adjusted performance metrics (simplified implementation)
- **Outperformance**: Direct comparison of returns

## API Endpoints

### Enhanced Metrics (Comprehensive)
```
GET /api/portfolio/metrics/enhanced
```
Returns all metrics in a single response for dashboard views.

### Individual Metric Categories
```
GET /api/portfolio/metrics/time-based     # Time-based performance only
GET /api/portfolio/metrics/advanced       # Advanced metrics (Sharpe, volatility, etc.)
GET /api/portfolio/metrics/risk          # Risk metrics (VaR, Sortino, etc.)
GET /api/portfolio/metrics/benchmarks    # Benchmark comparisons
```

## Response Structure

### Enhanced Metrics Response
```typescript
{
  "metrics": {
    "summary": {
      "totalValue": number,
      "totalCostBasis": number,
      "totalUnrealizedPnL": number,
      "totalRealizedPnL": number,
      "totalPercentageChange": number,
      "holdingsCount": number
    },
    "timeBasedPerformance": [
      {
        "period": "1D" | "7D" | "30D" | "90D" | "1Y" | "YTD",
        "startValue": number,
        "endValue": number,
        "absoluteReturn": number,
        "percentageReturn": number,
        "startDate": string,
        "endDate": string
      }
    ],
    "advancedMetrics": {
      "sharpeRatio": number | null,
      "volatility": number | null,
      "maxDrawdown": number | null,
      "maxDrawdownPeriod": { "start": string, "end": string } | null,
      "averageReturn": number,
      "winRate": number,
      "bestDay": { "date": string, "return": number } | null,
      "worstDay": { "date": string, "return": number } | null,
      "totalTradingDays": number
    },
    "riskMetrics": {
      "valueAtRisk95": number | null,
      "valueAtRisk99": number | null,
      "conditionalValueAtRisk": number | null,
      "downsideDeviation": number | null,
      "sortinoRatio": number | null
    },
    "benchmarkComparisons": [
      {
        "portfolioReturn": number,
        "benchmarkReturn": number,
        "alpha": number,
        "beta": number | null,
        "correlation": number | null,
        "outperformance": number,
        "benchmarkName": string
      }
    ]
  }
}
```

## Service Functions

### Core Functions
- `getEnhancedPortfolioMetrics(userId)`: Main function returning all metrics
- `calculateTimeBasedPerformance(userId)`: Time-based performance calculation
- `calculateAdvancedMetrics(userId)`: Advanced portfolio statistics
- `calculateRiskMetrics(userId)`: Risk assessment metrics
- `calculateBenchmarkComparisons(userId)`: Performance vs benchmarks

### Helper Functions
- `estimatePortfolioValueAtDate(userId, date)`: Historical portfolio valuation
- `calculateDailyReturns(userId, days)`: Daily return series calculation
- `calculateMaxDrawdown(dailyReturns)`: Maximum drawdown calculation

## Implementation Notes

### Performance Optimizations
- **Parallel Execution**: All metric calculations run in parallel using `Promise.all()`
- **Caching**: Historical price data is cached to reduce API calls
- **Fallback Data**: Graceful degradation when calculations fail

### Data Requirements
- **Transaction History**: Accurate metrics require complete transaction history
- **Historical Prices**: External price API integration for historical valuations
- **Minimum Data**: Some metrics require sufficient historical data (e.g., 30+ days for meaningful volatility)

### Error Handling
- **Graceful Degradation**: Returns null values for metrics that can't be calculated
- **Fallback Structures**: Always returns valid response structure even on errors
- **Logging**: Comprehensive error logging for debugging

## Testing

Comprehensive test suite in `portfolioMetrics.test.ts` covering:
- All API endpoints
- Service function calculations
- Error handling scenarios
- Edge cases with limited data

## Future Enhancements

1. **Enhanced Benchmark Correlations**: Implement proper correlation and beta calculations
2. **Sector Analysis**: Portfolio allocation by crypto sectors
3. **Performance Attribution**: Identify which holdings contribute most to returns
4. **Risk Budgeting**: Allocate risk across different holdings
5. **Monte Carlo Simulations**: Portfolio stress testing
6. **Custom Benchmarks**: User-defined benchmark portfolios

## Usage Examples

### Get Complete Metrics
```javascript
const response = await fetch('/api/portfolio/metrics/enhanced', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { metrics } = await response.json();
```

### Get Only Risk Metrics
```javascript
const response = await fetch('/api/portfolio/metrics/risk', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { riskMetrics } = await response.json();
```
