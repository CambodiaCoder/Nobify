import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { ArrowUp, ArrowDown, Loader2, AlertCircle } from 'lucide-react';
import { portfolioApi, getCryptoLogoUrl } from '../../lib/api';

const TokenList: React.FC = () => {
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
      setError('Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  if (loading) {
    return (
      <Card title="Your Assets" className="mb-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading holdings...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Your Assets" className="mb-6">
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

  if (holdings.length === 0) {
    return (
      <Card title="Your Assets" className="mb-6">
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-600 dark:text-gray-400">No holdings found. Add some assets to your portfolio!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Your Assets" className="mb-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Asset
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Change
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Holdings
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {holdings.map((holding) => (
              <tr key={holding.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img
                      src={getCryptoLogoUrl(holding.tokenSymbol)}
                      alt={holding.tokenName}
                      className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 p-1"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://placehold.co/200x200/9333ea/ffffff?text=' + holding.tokenSymbol;
                      }}
                    />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {holding.tokenName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {holding.tokenSymbol}
                      </div>
                    </div>
                  </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700 dark:text-gray-300">
                  {holding.currentPrice ?
                    `$${holding.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                    'N/A'
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {holding.percentageChange !== null ? (
                    <div className="flex items-center justify-end">
                      {holding.percentageChange > 0 ? (
                        <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${holding.percentageChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {Math.abs(holding.percentageChange).toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700 dark:text-gray-300">
                  {holding.currentAmount.toLocaleString(undefined, {
                    minimumFractionDigits: holding.currentAmount < 1 ? 4 : 2,
                    maximumFractionDigits: 8
                  })} {holding.tokenSymbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                  {holding.currentValue ?
                    `$${holding.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                    'N/A'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default TokenList;
