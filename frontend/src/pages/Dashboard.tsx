import React from 'react';
import PortfolioSummary from '../components/dashboard/PortfolioSummary';
import AssetDistribution from '../components/dashboard/AssetDistribution';
import TokenList from '../components/dashboard/TokenList';
import RecentActivity from '../components/dashboard/RecentActivity';

const Dashboard: React.FC = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Your crypto portfolio at a glance</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PortfolioSummary />
          <TokenList />
        </div>
        
        <div>
          <AssetDistribution />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;