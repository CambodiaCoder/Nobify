import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { Loader2, AlertCircle } from 'lucide-react';
import { portfolioApi } from '../../lib/api';

const AssetDistribution: React.FC = () => {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHoldings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await portfolioApi.getHoldings();
      setHoldings(data.holdings);
    } catch (err) {
      console.error('Error fetching holdings:', err);
      setError('Failed to load asset distribution');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  if (loading) {
    return (
      <Card title="Asset Distribution" className="mb-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Asset Distribution" className="mb-6">
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
            <button
              onClick={fetchHoldings}
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Try again
            </button>
          </div>
        </div>
      </Card>
    );
  }

  // Filter holdings with valid current values
  const validHoldings = holdings.filter(holding => holding.currentValue && holding.currentValue > 0);

  if (validHoldings.length === 0) {
    return (
      <Card title="Asset Distribution" className="mb-6">
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-600 dark:text-gray-400">No asset data available</p>
        </div>
      </Card>
    );
  }

  const totalValue = validHoldings.reduce((total, holding) => total + (holding.currentValue || 0), 0);

  // Calculate percentage for each holding
  const holdingsWithPercentage = validHoldings.map(holding => ({
    ...holding,
    percentage: ((holding.currentValue || 0) / totalValue) * 100
  }));

  // Sort holdings by value (largest first)
  const sortedHoldings = [...holdingsWithPercentage].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));

  return (
    <Card title="Asset Distribution" className="mb-6">
      <div className="p-4">
        <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          {sortedHoldings.map((holding, index) => (
            <div
              key={holding.id}
              className="h-full"
              style={{
                width: `${holding.percentage}%`,
                backgroundColor: getColorByIndex(index),
              }}
            ></div>
          ))}
        </div>

        <div className="space-y-3">
          {sortedHoldings.map((holding, index) => (
            <div key={holding.id} className="flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className="h-3 w-3 rounded-full mr-2"
                  style={{ backgroundColor: getColorByIndex(index) }}
                ></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {holding.tokenName} ({holding.tokenSymbol})
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                  ${(holding.currentValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-12 text-right">
                  {holding.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

// Function to get a color based on the index
function getColorByIndex(index: number): string {
  const colors = [
    '#7A5AF8', // Indigo
    '#2DD4BF', // Teal
    '#F97316', // Orange
    '#10B981', // Green
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#F59E0B', // Amber
    '#06B6D4'  // Cyan
  ];
  
  return colors[index % colors.length];
}

export default AssetDistribution;