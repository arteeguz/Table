// src/components/Modal.jsx

import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

export default function Modal({ isVisible, hideModal, children }) {
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      onClick={hideModal}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-4 w-full max-w-lg p-8 rounded-lg bg-white text-base font-light leading-relaxed antialiased shadow-2xl dark:bg-primary"
      >
        <div className="flex justify-end">
          <button
            onClick={hideModal}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 hover:bg-red-500 hover:text-white dark:text-white dark:hover:bg-red-500 dark:hover:text-white"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}