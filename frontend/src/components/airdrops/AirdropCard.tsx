import React, { useState } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Clock, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { Airdrop } from '../../types';
import { getCryptoLogoUrl, airdropApi } from '../../lib/api';

interface AirdropCardProps {
  airdrop: Airdrop;
  onClaimToggle?: () => void; // Callback to refresh parent data
}

const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop, onClaimToggle }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaimToggle = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await airdropApi.toggleClaim(airdrop.id);
      onClaimToggle?.(); // Refresh parent data
    } catch (err) {
      console.error('Error toggling claim:', err);
      setError('Failed to update claim status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  const getStatusBadge = () => {
    switch (airdrop.status) {
      case 'upcoming':
        return <Badge variant="warning">Upcoming</Badge>;
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'completed':
        return <Badge variant="primary">Completed</Badge>;
      case 'missed':
        return <Badge variant="error">Missed</Badge>;
      default:
        return null;
    }
  };

  const getTimeRemaining = () => {
    const deadline = new Date(airdrop.deadline).getTime();
    const now = Date.now();
    const difference = deadline - now;
    
    if (difference <= 0) {
      return 'Expired';
    }
    
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };
  
  const getActionButton = () => {
    switch (airdrop.status) {
      case 'upcoming':
        return (
          <Button variant="outline" fullWidth disabled={isLoading}>
            Set Reminder
          </Button>
        );
      case 'active':
        return (
          <Button
            variant="primary"
            fullWidth
            onClick={handleClaimToggle}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Claiming...
              </>
            ) : (
              'Claim Airdrop'
            )}
          </Button>
        );
      case 'completed':
        return (
          <Button
            variant="outline"
            fullWidth
            onClick={handleClaimToggle}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Claimed
              </>
            )}
          </Button>
        );
      case 'missed':
        return (
          <Button variant="outline" fullWidth disabled>
            <X className="h-4 w-4 mr-2" />
            Missed
          </Button>
        );
      default:
        return null;
    }
  };
  
  return (
    <Card className="h-full" hoverable>
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <img
              src={getCryptoLogoUrl(airdrop.symbol)}
              alt={airdrop.name}
              className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 p-1"
              loading="lazy" // Add lazy loading for performance
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Fallback to a generic placeholder if the crypto logo API fails
                target.src = 'https://placehold.co/200x200/9333ea/ffffff?text=' + airdrop.symbol;
              }}
            />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {airdrop.name} ({airdrop.symbol})
              </h3>
              <div className="mt-1 flex items-center">
                {getStatusBadge()}
                {airdrop.eligibility ? (
                  <Badge variant="success" className="ml-2">Eligible</Badge>
                ) : (
                  <Badge variant="error" className="ml-2">Not Eligible</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-gray-900 dark:text-white">
              ~${airdrop.estimatedValue}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Estimated Value
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
          {airdrop.description}
        </p>
        
        {(airdrop.status === 'upcoming' || airdrop.status === 'active') && (
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Clock className="h-4 w-4 mr-1" />
            <span>{getTimeRemaining()} remaining</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {getActionButton()}
      </div>
    </Card>
  );
};

export default AirdropCard;