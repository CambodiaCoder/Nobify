import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { portfolioApi } from '../../lib/api';

const StatItem: React.FC<{
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
}> = ({ title, value, change, icon }) => {
  return (
    <div className="flex items-start p-4">
      <div className="rounded-lg p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mr-4">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xl font-semibold mt-1 text-gray-900 dark:text-white">{value}</p>
        {change !== undefined && (
          <div className="flex items-center mt-1">
            {change > 0 ? (
              <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
            ) : (
              <ArrowDown className="h-3 w-3 text-red-500 mr-1" />
            )}
            <span className={`text-xs font-medium ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Math.abs(change).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const PortfolioSummary: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolioSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await portfolioApi.getSummary();
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching portfolio summary:', err);
      setError('Failed to load portfolio summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioSummary();
  }, []);

  if (loading) {
    return (
      <Card className="mb-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading portfolio...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6">
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
            <button
              onClick={fetchPortfolioSummary}
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Try again
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="mb-6">
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-600 dark:text-gray-400">No portfolio data available</p>
        </div>
      </Card>
    );
  }

  // Calculate 24h change value (using unrealized PnL as approximation)
  const change24hValue = summary.totalUnrealizedPnL || 0;
  const change24hPercent = summary.totalPercentageChange || 0;

  return (
    <Card className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
        <StatItem
          title="Total Portfolio Value"
          value={`$${(summary.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatItem
          title="Total P&L"
          value={`$${change24hValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={change24hPercent}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatItem
          title="Holdings Count"
          value={`${summary.holdingsCount || 0} assets`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>
    </Card>
  );
};

export default PortfolioSummary;
