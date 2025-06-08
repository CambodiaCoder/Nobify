import React, { useState, useEffect } from 'react';
import PriceChart from '../components/portfolio/PriceChart';
import TokenList from '../components/dashboard/TokenList';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Wallet, TrendingUp, BarChart3, PieChart, History, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { portfolioApi } from '../lib/api';

const Portfolio: React.FC = () => {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [selectedHolding, setSelectedHolding] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [addForm, setAddForm] = useState({
    tokenSymbol: '',
    tokenName: '',
    currentAmount: '',
  });

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await portfolioApi.getHoldings();
      setHoldings(data.holdings);
      if (data.holdings.length > 0 && !selectedHolding) {
        setSelectedHolding(data.holdings[0]);
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
      setError('Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);
  
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Portfolio</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage and track your crypto assets</p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-md">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              List
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                viewMode === 'chart'
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <PieChart className="h-4 w-4 mr-1" />
              Charts
            </button>
          </div>
          
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mr-3" />
          <span className="text-gray-600 dark:text-gray-400">Loading portfolio...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error loading portfolio</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchPortfolioData} variant="primary">
            Try Again
          </Button>
        </div>
      ) : holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wallet className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No assets in portfolio</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Start building your portfolio by adding your first asset.</p>
          <Button onClick={() => setShowAddModal(true)} variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Asset
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        <TokenList />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {selectedHolding && (
              <>
                <Card className="mb-6">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedHolding.tokenName} ({selectedHolding.tokenSymbol})
                        </h3>
                        <div className="flex items-center mt-1">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white mr-2">
                            ${(selectedHolding.currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {selectedHolding.percentageChange !== null && (
                            <span className={`text-sm font-medium ${selectedHolding.percentageChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {selectedHolding.percentageChange >= 0 ? '+' : ''}{selectedHolding.percentageChange.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTransactionModal(true)}
                        >
                          <History className="h-4 w-4 mr-1" />
                          History
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowEditModal(true)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-start">
                          <Wallet className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 mr-3" />
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Holdings</div>
                            <div className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                              {selectedHolding.currentAmount.toLocaleString(undefined, {
                                minimumFractionDigits: selectedHolding.currentAmount < 1 ? 4 : 2,
                                maximumFractionDigits: 8
                              })} {selectedHolding.tokenSymbol}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-start">
                          <TrendingUp className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 mr-3" />
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Current Value</div>
                            <div className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                              ${(selectedHolding.currentValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-start">
                          <TrendingUp className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 mr-3" />
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">P&L</div>
                            <div className={`text-lg font-medium mt-1 ${
                              (selectedHolding.unrealizedPnL || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {(selectedHolding.unrealizedPnL || 0) >= 0 ? '+' : ''}${(selectedHolding.unrealizedPnL || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
          
          <div>
            <Card title="Your Assets">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {holdings.map((holding) => (
                  <div
                    key={holding.id}
                    onClick={() => setSelectedHolding(holding)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedHolding?.id === holding.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                            {holding.tokenSymbol.substring(0, 2)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {holding.tokenName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {holding.tokenSymbol}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          ${(holding.currentValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {holding.percentageChange !== null && (
                          <div className={`text-xs ${holding.percentageChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {holding.percentageChange >= 0 ? '+' : ''}{holding.percentageChange.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Asset"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Symbol
            </label>
            <input
              type="text"
              value={addForm.tokenSymbol}
              onChange={(e) => setAddForm({ ...addForm, tokenSymbol: e.target.value.toUpperCase() })}
              placeholder="e.g., BTC, ETH, SOL"
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Name
            </label>
            <input
              type="text"
              value={addForm.tokenName}
              onChange={(e) => setAddForm({ ...addForm, tokenName: e.target.value })}
              placeholder="e.g., Bitcoin, Ethereum, Solana"
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              step="any"
              value={addForm.currentAmount}
              onChange={(e) => setAddForm({ ...addForm, currentAmount: e.target.value })}
              placeholder="0.00"
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                // TODO: Implement add asset functionality
                console.log('Add asset:', addForm);
                setShowAddModal(false);
                setAddForm({ tokenSymbol: '', tokenName: '', currentAmount: '' });
              }}
            >
              Add Asset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        title={`Transaction History - ${selectedHolding?.tokenSymbol || ''}`}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Transaction history functionality will be implemented here.
          </p>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowTransactionModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit ${selectedHolding?.tokenSymbol || ''}`}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Edit asset functionality will be implemented here.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowEditModal(false)}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Portfolio;