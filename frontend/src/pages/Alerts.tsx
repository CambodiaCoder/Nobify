import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import AlertItem from '../components/alerts/AlertItem';
import { Bell, Plus, Filter, Loader2, AlertCircle, Check } from 'lucide-react';
import { alertsApi } from '../lib/api';

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create alert form state
  const [createForm, setCreateForm] = useState({
    type: 'price',
    condition: 'above',
    threshold: '',
    tokenSymbol: '',
    airdropId: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await alertsApi.getAlerts();
      setAlerts(data.alerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    try {
      setCreating(true);
      const alertData: any = {
        type: createForm.type,
        condition: createForm.condition,
      };

      if (createForm.type === 'price') {
        alertData.threshold = parseFloat(createForm.threshold);
        alertData.tokenSymbol = createForm.tokenSymbol;
      } else if (createForm.type === 'airdrop') {
        alertData.airdropId = createForm.airdropId;
      }

      await alertsApi.createAlert(alertData);
      await fetchAlerts(); // Refresh alerts
      setCreateForm({
        type: 'price',
        condition: 'above',
        threshold: '',
        tokenSymbol: '',
        airdropId: '',
      });
    } catch (err) {
      console.error('Error creating alert:', err);
      setError('Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await alertsApi.deleteAlert(id);
      await fetchAlerts(); // Refresh alerts
    } catch (err) {
      console.error('Error deleting alert:', err);
      setError('Failed to delete alert');
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);
  
  const filteredAlerts = alerts.filter(alert => {
    if (typeFilter !== 'all' && alert.type !== typeFilter) {
      return false;
    }
    return true;
  });
  
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Alerts</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your notifications and alerts</p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="form-select rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="all">All Alerts</option>
            <option value="price">Price Alerts</option>
            <option value="airdrop">Airdrop Alerts</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mr-3" />
                <span className="text-gray-600 dark:text-gray-400">Loading alerts...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error loading alerts</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <Button onClick={fetchAlerts} variant="primary">
                  Try Again
                </Button>
              </div>
            ) : filteredAlerts.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAlerts.map(alert => (
                  <div key={alert.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-4">
                          <Bell className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} Alert
                            </h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              alert.active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {alert.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {alert.condition} {alert.threshold && `$${alert.threshold}`} {alert.tokenSymbol && `for ${alert.tokenSymbol}`}
                          </p>
                          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <span>Created: {new Date(alert.createdAt).toLocaleDateString()}</span>
                            {alert.lastTriggered && (
                              <span className="ml-4">Last triggered: {new Date(alert.lastTriggered).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAlert(alert.id)}
                        className="ml-4"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 mb-4">
                  <Bell className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No alerts found</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  {alerts.length === 0
                    ? "You don't have any alerts yet. Create your first alert to get started!"
                    : "No alerts match your current filters. Try adjusting your filters."
                  }
                </p>
              </div>
            )}
          </Card>
        </div>
        
        <div>
          <Card title="Create Alert">
            <div className="p-5">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alert Type
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="price">Price Alert</option>
                  <option value="airdrop">Airdrop Alert</option>
                </select>
              </div>

              {createForm.type === 'price' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Token Symbol
                    </label>
                    <input
                      type="text"
                      value={createForm.tokenSymbol}
                      onChange={(e) => setCreateForm({ ...createForm, tokenSymbol: e.target.value.toUpperCase() })}
                      placeholder="e.g., BTC, ETH, SOL"
                      className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Condition
                    </label>
                    <div className="flex space-x-2">
                      <select
                        value={createForm.condition}
                        onChange={(e) => setCreateForm({ ...createForm, condition: e.target.value })}
                        className="w-1/3 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                      </select>
                      <input
                        type="number"
                        step="any"
                        value={createForm.threshold}
                        onChange={(e) => setCreateForm({ ...createForm, threshold: e.target.value })}
                        placeholder="Enter price"
                        className="w-2/3 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {createForm.type === 'airdrop' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Airdrop ID
                  </label>
                  <input
                    type="text"
                    value={createForm.airdropId}
                    onChange={(e) => setCreateForm({ ...createForm, airdropId: e.target.value })}
                    placeholder="Enter airdrop ID"
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    You can find airdrop IDs in the Airdrops page
                  </p>
                </div>
              )}

              <Button
                variant="primary"
                fullWidth
                onClick={createAlert}
                disabled={creating || (createForm.type === 'price' && (!createForm.tokenSymbol || !createForm.threshold)) || (createForm.type === 'airdrop' && !createForm.airdropId)}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Alert'
                )}
              </Button>
            </div>
          </Card>
          
          <Card title="Alert Settings" className="mt-6">
            <div className="p-5 space-y-4">
              <div className="text-center">
                <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Notification settings will be available in a future update.
                </p>
              </div>

              <div className="space-y-3 opacity-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Receive alerts via email</p>
                  </div>
                  <div className="w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full relative">
                    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Receive alerts on your device</p>
                  </div>
                  <div className="w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full relative">
                    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform"></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Alerts;