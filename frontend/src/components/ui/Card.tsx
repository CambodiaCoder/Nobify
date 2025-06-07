import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  title, 
  subtitle, 
  children, 
  className = '', 
  footer,
  hoverable = false
}) => {
  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700
        ${hoverable ? 'transition-all duration-200 hover:shadow-md' : ''}
        ${className}
      `}
    >
      {(title || subtitle) && (
        <div className="px-6 pt-5 pb-3">
          {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>}
          {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      )}
      <div className={`${title || subtitle ? '' : 'p-6'}`}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;