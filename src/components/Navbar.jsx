import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faHouse, faSun, faMoon } from '@fortawesome/free-solid-svg-icons';

const Navbar = ({ toggleSidebar, isExpanded }) => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <nav
      className={`${
        isExpanded ? 'pl-0 md:pl-[250px]' : ''
      } max-h-[100px] min-h-[60px] w-full p-[8px] transition-all duration-500 sm:p-4 fixed top-0 left-0 right-0 z-50`}
    >
      <div className="flex h-full w-full flex-row items-center justify-between px-0 sm:px-[24px]">
        {/* Toggle sidebar button */}
        <button
          className="grid h-[70px] w-[50px] place-items-center rounded-full transition-all duration-300 hover:text-accent dark:hover:text-secondary ${
            isExpanded ? 'ml-0' : 'ml-4'
          }"
          onClick={toggleSidebar}
        >
          <FontAwesomeIcon icon={faBars} />
        </button>

        {/* Nav links */}
        <div className="flex flex-row items-center justify-center">
          <Link
            to="/"
            className="mx-2 flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-full transition-all duration-300 hover:text-accent dark:hover:text-secondary"
          >
            <FontAwesomeIcon icon={faHouse} />
          </Link>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className={`${
              darkMode ? 'hover:text-accent' : 'hover:text-blue-800'
            } mx-2 flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-full transition-all duration-100 hover:text-accent dark:hover:text-secondary`}
            >
            {darkMode ? (
              <FontAwesomeIcon icon={faSun} />
            ) : (
              <FontAwesomeIcon icon={faMoon} />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;