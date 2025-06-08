import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { Clock, DollarSign, Gift, Bell, Loader2, AlertCircle } from 'lucide-react';
import { alertsApi, airdropApi } from '../../lib/api';

const RecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both alerts and airdrops in parallel
      const [alertsResponse, airdropsResponse] = await Promise.all([
        alertsApi.getAlerts().catch(() => ({ alerts: [] })), // Graceful fallback
        airdropApi.getAirdrops().catch(() => []) // Graceful fallback
      ]);

      // Transform alerts into activity items
      const alertActivities = alertsResponse.alerts.map(alert => ({
        id: `alert-${alert.id}`,
        type: 'alert',
        title: `${alert.type} Alert`,
        description: `${alert.condition} alert${alert.tokenSymbol ? ` for ${alert.tokenSymbol}` : ''}`,
        timestamp: new Date(alert.lastTriggered || alert.createdAt).getTime(),
        priority: alert.active ? 'high' : 'low' as 'high' | 'medium' | 'low'
      }));

      // Transform airdrops into activity items
      const airdropActivities = airdropsResponse
        .filter(airdrop => airdrop.status === 'active' || airdrop.status === 'upcoming')
        .map(airdrop => ({
          id: `airdrop-${airdrop.id}`,
          type: 'airdrop',
          title: `${airdrop.name} airdrop ${airdrop.status === 'active' ? 'active' : 'upcoming'}`,
          description: airdrop.description,
          timestamp: new Date(airdrop.deadline).getTime(),
          priority: airdrop.status === 'active' ? 'high' : 'medium' as 'high' | 'medium' | 'low'
        }));

      // Combine and sort by timestamp (most recent first)
      const combinedActivities = [...alertActivities, ...airdropActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5); // Show only the 5 most recent activities

      setActivities(combinedActivities);
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      setError('Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();
  }, []);
  
  if (loading) {
    return (
      <Card title="Recent Activity">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading activity...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Recent Activity">
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
            <button
              onClick={fetchRecentActivity}
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Try again
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Recent Activity">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {activities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
          </div>
        ) : (
          activities.map(activity => (
          <div key={activity.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-4">
                {activity.type === 'alert' ? (
                  <Bell className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                ) : (
                  <Gift className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {activity.title}
                  </p>
                  <Badge 
                    variant={
                      activity.priority === 'high' ? 'error' : 
                      activity.priority === 'medium' ? 'warning' : 
                      'default'
                    }
                    size="sm"
                    className="ml-2"
                  >
                    {activity.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {activity.description}
                </p>
                <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{formatTimeAgo(activity.timestamp)}</span>
                </div>
              </div>
            </div>
          </div>
          ))
        )}
      </div>
    </Card>
  );
};

// Helper function to format timestamp as relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {
    return `${interval} year${interval === 1 ? '' : 's'} ago`;
  }
  
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) {
    return `${interval} month${interval === 1 ? '' : 's'} ago`;
  }
  
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) {
    return `${interval} day${interval === 1 ? '' : 's'} ago`;
  }
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) {
    return `${interval} hour${interval === 1 ? '' : 's'} ago`;
  }
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) {
    return `${interval} minute${interval === 1 ? '' : 's'} ago`;
  }
  
  return 'just now';
}

export default RecentActivity;