import React from 'react';
import Badge from '../ui/Badge';
import { Check, Clock, Bell, TrendingUp, Gift } from 'lucide-react';
import { Alert } from '../../types';

interface AlertItemProps {
  alert: Alert;
  onMarkAsRead: (id: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onMarkAsRead }) => {
  const getIcon = () => {
    switch (alert.type) {
      case 'price':
        return <TrendingUp className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />;
      case 'airdrop':
        return <Gift className="h-5 w-5 text-orange-500 dark:text-orange-400" />;
      case 'news':
        return <Bell className="h-5 w-5 text-blue-500 dark:text-blue-400" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    }
  };
  
  const getPriorityBadge = () => {
    switch (alert.priority) {
      case 'high':
        return <Badge variant="error">High</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
        return <Badge variant="default">Low</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <div 
      className={`p-4 border-b border-gray-200 dark:border-gray-700 transition-colors ${
        !alert.read ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
      }`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-4">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {alert.title}
            </h4>
            {getPriorityBadge()}
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {alert.description}
          </p>
          
          {alert.relatedAsset && (
            <div className="mt-2 inline-flex items-center bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-300">
              {alert.relatedAsset.symbol}
            </div>
          )}
          
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Clock className="h-3 w-3 mr-1" />
              <span>{new Date(alert.timestamp).toLocaleString()}</span>
            </div>
            
            {!alert.read && (
              <button 
                onClick={() => onMarkAsRead(alert.id)}
                className="flex items-center text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertItem;