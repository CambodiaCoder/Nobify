import React from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'md',
  className = '',
  onClick,
}) => {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };
  
  return (
    <div
      className={`${sizeStyles[size]} ${className} rounded-full overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            // On error, replace with first letter of alt text
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = alt.charAt(0).toUpperCase();
            target.parentElement!.className += ' flex items-center justify-center text-gray-600 dark:text-gray-300 font-medium';
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-medium">
          {alt.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default Avatar;