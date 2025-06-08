import React, { useState } from 'react';
import Card from '../ui/Card';
import { Token } from '../../types';

interface PriceChartProps {
  token: Token;
}

const PriceChart: React.FC<PriceChartProps> = ({ token }) => {
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | 'ALL'>('1W');
  
  // Function to simulate filtering data based on time range
  const getFilteredData = () => {
    const today = Date.now();
    let filteredData = [...token.history];
    
    switch (timeRange) {
      case '1D':
        filteredData = token.history.filter(
          point => point.timestamp > today - 24 * 60 * 60 * 1000
        );
        break;
      case '1W':
        filteredData = token.history.filter(
          point => point.timestamp > today - 7 * 24 * 60 * 60 * 1000
        );
        break;
      case '1M':
        filteredData = token.history.filter(
          point => point.timestamp > today - 30 * 24 * 60 * 60 * 1000
        );
        break;
      case '3M':
        filteredData = token.history.filter(
          point => point.timestamp > today - 90 * 24 * 60 * 60 * 1000
        );
        break;
      default:
        break;
    }
    
    return filteredData;
  };
  
  const chartData = getFilteredData();
  
  // Get min and max price for chart scaling
  const minPrice = Math.min(...chartData.map(point => point.price));
  const maxPrice = Math.max(...chartData.map(point => point.price));
  const range = maxPrice - minPrice;
  const paddedMin = minPrice - range * 0.1;
  const paddedMax = maxPrice + range * 0.1;
  
  // Calculate percentage change
  const firstPrice = chartData[0]?.price || 0;
  const lastPrice = chartData[chartData.length - 1]?.price || 0;
  const percentageChange = ((lastPrice - firstPrice) / firstPrice) * 100;
  
  // Create SVG path for chart
  const createPath = () => {
    if (chartData.length < 2) return '';
    
    const maxX = chartData.length - 1;
    const width = 100; // Percentage width
    
    // Generate points
    const points = chartData.map((point, index) => {
      const x = (index / maxX) * width;
      const y = 100 - ((point.price - paddedMin) / (paddedMax - paddedMin) * 100);
      return `${x},${y}`;
    });
    
    // Create SVG path
    return `M${points.join(' L')}`;
  };
  
  const svgPath = createPath();
  const isPositiveChange = percentageChange >= 0;
  
  return (
    <Card className="mb-6">
      <div className="p-5">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {token.name} ({token.symbol})
            </h3>
            <div className="flex items-center mt-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white mr-2">
                ${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-medium ${isPositiveChange ? 'text-green-500' : 'text-red-500'}`}>
                {isPositiveChange ? '+' : ''}{percentageChange.toFixed(2)}%
              </span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {(['1D', '1W', '1M', '3M', 'ALL'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  timeRange === range
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        
        <div className="relative h-48 mb-4">
          <svg 
            viewBox="0 0 100 100" 
            className="w-full h-full" 
            preserveAspectRatio="none"
          >
            <path
              d={svgPath}
              fill="none"
              stroke={isPositiveChange ? '#10B981' : '#EF4444'}
              strokeWidth="2"
              className="transition-all duration-300"
            />
            
            {/* Gradient fill under the line */}
            <path
              d={`${svgPath} L100,100 L0,100 Z`}
              fill={`url(#gradient-${token.id})`}
              className="opacity-20 transition-all duration-300"
            />
            
            {/* Gradient definition */}
            <defs>
              <linearGradient
                id={`gradient-${token.id}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={isPositiveChange ? '#10B981' : '#EF4444'}
                  stopOpacity="0.8"
                />
                <stop
                  offset="100%"
                  stopColor={isPositiveChange ? '#10B981' : '#EF4444'}
                  stopOpacity="0.1"
                />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{new Date(chartData[0]?.timestamp || Date.now()).toLocaleDateString()}</span>
          <span>{new Date(chartData[chartData.length - 1]?.timestamp || Date.now()).toLocaleDateString()}</span>
        </div>
      </div>
    </Card>
  );
};

export default PriceChart;