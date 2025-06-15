import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChalkboardUser,
  faMinus,
  faPlus,
  faList,
  faSitemap,
  faTools,
  faBox,
  faBolt,
  faDatabase,
  faClipboardList,
  faTerminal,
  faUserCog,
  faComputer,
  faListCheck,
  faChartBar,
  faQrcode,
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

const Sidebar = ({ isExpanded, toggleSidebar, currentPath }) => {
  const [openSubmenu, setOpenSubmenu] = useState(null);

  const sidebarData = [
    {
      title: 'Dashboard',
      link: '/',
      icon: faChalkboardUser,
    },
    {
      title: 'Central Database',
      link: '/central-database',
      icon: faDatabase,
    },
    {
      title: 'Asset Readiness',
      link: '/asset-readiness',
      icon: faListCheck,
    },
    {
      title: 'Batch Management',
      link: '/batch',
      icon: faSitemap,
      childItems: [
        {
          title: 'Add Assets',
          link: '/batch',
          icon: faPlus,
        },
        {
          title: 'View Assets',
          link: '/viewbatch',
          icon: faList,
        },
      ],
    },
    {
      title: 'QR Code Generator',
      link: '/qrcode',
      icon: faQrcode,
    },
    {
      title: 'Onboarding',
      link: '/onboard',
      icon: faCalendarCheck,
    },
    {
      title: 'Statistics',
      link: '/stats',
      icon: faChartBar,
    },
    {
      title: 'Defective Devices',
      link: '/defective',
      icon: faTools,
    },
    {
      title: 'Supplies Inventory',
      link: '/supplies-inventory',
      icon: faClipboardList,
    },
    {
      title: 'Powershell',
      link: '/powershell',
      icon: faTerminal,
    },
    {
      title: 'User Details',
      link: '/userdata',
      icon: faUserCog,
    },
    {
      title: 'Asset Details',
      link: '/assetdata',
      icon: faComputer,
    },
    {
      title: 'Amp Balancer',
      link: '/amp-balancer',
      icon: faBolt,
    },
  ];

  const isLinkActive = (linkPath) => {
    return currentPath === linkPath;
  };

  const toggleSubmenu = (index) => {
    if (openSubmenu === index) {
      setOpenSubmenu(null);
    } else {
      setOpenSubmenu(index);
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 z-[999] h-full bg-gray-800 shadow-2xl transition-all duration-500 ${
        isExpanded ? 'w-[250px]' : 'w-[60px]'
      }`}
    >
      {/* Header */}
      <div className="flex h-[100px] items-center justify-center p-4">
        <img src="https://seeklogo.com/images/R/rbc-royal-bank-of-canada-logo-344B607721-seeklogo.com.png" alt="Logo" className={`w-[50px] ${isExpanded ? 'mr-5' : 'mr-0'}`} />
        {isExpanded && (

          <Link
            to="/"
            className="text-2xl font-bold uppercase tracking-wider text-white"
          >
            RBC <span className="mr-5 text-blue-400">ONBOARD</span>
          </Link>
        )}
      </div>

      {/* Nav links for sidebar */}
      <div className="flex flex-col">
        {sidebarData.map((item, index) => (
          <div key={index}>
            <Link
              to={item.link}
              className={`${
                isLinkActive(item.link) ? 'bg-blue-500' : 'hover:bg-gray-700'
              } flex items-center p-4 text-white transition-colors duration-200`}
              onClick={item.childItems ? () => toggleSubmenu(index) : undefined}
            >
              <FontAwesomeIcon icon={item.icon} className="h-[20px] w-[20px]" />
              {isExpanded && <span className="ml-4">{item.title}</span>}
              {item.childItems && isExpanded && (
                <FontAwesomeIcon
                  icon={openSubmenu === index ? faMinus : faPlus}
                  className={`ml-auto transform transition-transform duration-300 ${
                    openSubmenu === index ? '' : 'rotate-180'
                  }`}
                />
              )}
            </Link>

            {/* Submenu items */}
            {item.childItems && openSubmenu === index && (
                item.childItems.map((childItem, childIndex) => (
                  <Link
                    key={childIndex}
                    to={childItem.link}
                    className={`${
                      isLinkActive(childItem.link) ? 'bg-accent hover:bg-accent/90' : 'hover:bg-gray-700'
                    } flex items-center p-4 text-white transition-colors duration-200 ${
                      isExpanded ? 'pl-12' : 'pl-4'
                    }`}
                  >
                    <FontAwesomeIcon icon={childItem.icon} className="h-[20px] w-[20px]" />
                    {isExpanded && <span className="ml-4">{childItem.title}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Toggle sidebar */}
      <div
        className="absolute bottom-0 flex h-[50px] w-full cursor-pointer items-center justify-center bg-blue-500 text-white hover:bg-blue-400"
        onClick={toggleSidebar}
      >
        <FontAwesomeIcon icon={isExpanded ? faMinus : faPlus} size="lg" />
      </div>
    </nav>
  );
};

export default Sidebar;