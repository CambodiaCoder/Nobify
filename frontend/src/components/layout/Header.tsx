import React, { useState } from 'react';
import { Bell, Moon, Sun, Menu } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import { mockAlerts } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfileModal } from '../users/UserProfileModal'; // Import UserProfileModal

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // State for profile modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null); // State to store selected user ID
  
  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDarkMode(!isDarkMode);
  };

  const handleProfileClick = (userId: string) => {
    setSelectedUserId(userId);
    setIsProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
    setSelectedUserId(null);
  };
  
  const unreadAlerts = mockAlerts.filter(alert => !alert.read);
  
  return (
    <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-30">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center lg:hidden">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-10 pl-4 pr-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
            >
              <Bell className="h-5 w-5" />
              {unreadAlerts.length > 0 && (
                <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {unreadAlerts.length}
                </span>
              )}
            </button>
            
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {mockAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border-b border-gray-200 dark:border-gray-700 ${!alert.read ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                    >
                      <div className="flex justify-between">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">{alert.title}</h4>
                        <Badge
                          variant={
                            alert.priority === 'high' ? 'error' :
                            alert.priority === 'medium' ? 'warning' :
                            'default'
                          }
                        >
                          {alert.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{alert.description}</p>
                      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                  <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center">
            {user && (
              <div
                className="flex items-center" // Removed cursor-pointer as Avatar now handles click
              >
                <Avatar
                  src={user.profileImage || `https://ui-avatars.com/api/?name=${user.name || user.email}&background=random`}
                  alt={user.name || user.email}
                  size="sm"
                  className="mr-2"
                  onClick={() => handleProfileClick(user.id)} // Add onClick handler
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:block">
                  {user.name || user.email}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfileModal}
        />
      )}
    </header>
  );
};

export default Header;