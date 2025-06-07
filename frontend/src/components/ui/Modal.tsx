import React from 'react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onConfirm?: () => void; // Make optional
  message?: string; // Make optional
  children?: React.ReactNode; // Add children prop
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, message, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">{title}</h3>
          {message && ( // Conditionally render message
            <div className="mt-2 px-7 py-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
            </div>
          )}
          {children} {/* Render children */}
          <div className="items-center px-4 py-3">
            {onConfirm && ( // Conditionally render confirm button
              <Button onClick={onConfirm} className="mr-2 bg-red-600 hover:bg-red-700 text-white">
                Confirm
              </Button>
            )}
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;