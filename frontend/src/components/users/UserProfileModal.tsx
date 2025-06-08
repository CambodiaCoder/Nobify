import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { userApi, PublicUserProfile } from '../../lib/api';
import Avatar from '../ui/Avatar';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, isOpen, onClose }) => {
  const [userProfile, setUserProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      setError(null);
      userApi.getPublicUserProfile(userId)
        .then(response => {
          setUserProfile(response.user);
        })
        .catch(err => {
          console.error('Error fetching user profile:', err);
          setError('Failed to load user profile.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setUserProfile(null); // Clear profile when modal is closed
    }
  }, [userId, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Profile">
      {loading && <p>Loading profile...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {userProfile && (
        <div className="flex flex-col items-center p-4">
          <Avatar src={userProfile.profileImage || undefined} alt={userProfile.name || 'User'} size="lg" />
          <h2 className="text-xl font-bold mt-4">{userProfile.name || 'Anonymous User'}</h2>
          <p className="text-gray-500">User ID: {userProfile.id}</p>
          {/* Add more profile details here as needed */}
        </div>
      )}
    </Modal>
  );
};