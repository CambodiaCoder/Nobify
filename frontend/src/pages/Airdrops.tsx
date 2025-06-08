import React, { useState, useEffect } from 'react';
import AirdropCard from '../components/airdrops/AirdropCard';
import Button from '../components/ui/Button';
import { Filter, Loader2, AlertCircle } from 'lucide-react';
import { airdropApi } from '../lib/api';
import { Airdrop } from '../types';

const Airdrops: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eligibilityFilter, setEligibilityFilter] = useState<string>('all');
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch airdrops from API
  const fetchAirdrops = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filters for API call
      const filters: { status?: string; upcoming?: boolean; completed?: boolean } = {};
      if (statusFilter !== 'all') {
        if (statusFilter === 'upcoming') {
          filters.upcoming = true;
        } else if (statusFilter === 'completed') {
          filters.completed = true;
        } else {
          filters.status = statusFilter;
        }
      }

      const fetchedAirdrops = await airdropApi.getAirdrops(filters);
      setAirdrops(fetchedAirdrops);
    } catch (err) {
      console.error('Error fetching airdrops:', err);
      setError('Failed to load airdrops. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch airdrops on component mount and when filters change
  useEffect(() => {
    fetchAirdrops();
  }, [statusFilter]);

  // Filter airdrops based on eligibility filter (client-side filtering)
  const filteredAirdrops = airdrops.filter(airdrop => {
    if (eligibilityFilter === 'eligible' && !airdrop.eligibility) {
      return false;
    }

    if (eligibilityFilter === 'not-eligible' && airdrop.eligibility) {
      return false;
    }

    return true;
  });
  
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Airdrops</h1>
          <p className="text-gray-600 dark:text-gray-400">Track and claim your crypto airdrops</p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
            </select>
            
            <select
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="form-select rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="all">All Eligibility</option>
              <option value="eligible">Eligible</option>
              <option value="not-eligible">Not Eligible</option>
            </select>
          </div>
          
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
        </div>
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Loading airdrops...</h3>
          <p className="text-gray-500 dark:text-gray-400">Please wait while we fetch your airdrops.</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Error loading airdrops</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mb-4">{error}</p>
          <Button onClick={fetchAirdrops} variant="primary">
            Try Again
          </Button>
        </div>
      )}

      {/* Airdrops Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAirdrops.length > 0 ? (
            filteredAirdrops.map(airdrop => (
              <AirdropCard
                key={airdrop.id}
                airdrop={airdrop}
                onClaimToggle={fetchAirdrops} // Refresh data after claim toggle
              />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 mb-4">
                <Filter className="h-8 w-8 text-gray-500 dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No airdrops found</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                {airdrops.length === 0
                  ? "You don't have any airdrops yet. Check back later for new opportunities!"
                  : "Try adjusting your filters to find more airdrops."
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Airdrops;