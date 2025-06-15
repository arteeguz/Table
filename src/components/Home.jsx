import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDatabase,
  faClipboard,
  faTools,
  faLaptopCode,
  faBolt,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import { useTableContext } from './TableContext';

const Home = ({ darkMode }) => {
  const [statistics, setStatistics] = useState({
    totalAssets: 0,
    defectiveDevices: 0,
    assetsbyTechnician: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTableName, setSelectedTableName] = useTableContext();


  const fetchStatistics = async () => {
    try {
      const url = selectedTableName ? `http://sei60590.fg.rbc.com:5000/api/statistics-tablename?name=${selectedTableName}` : 'http://sei60590.fg.rbc.com:5000/api/statistics';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      const data = await response.json();
      setStatistics({
        totalAssets: data.total_assets,
        defectiveDevices: data.defective_devices,
        assetsbyTechnician: data.assets_by_technician,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching statistics:', error.message);
      setError('Failed to fetch statistics');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const handleClick = (link) => {
    window.location.href = link;
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div className={`mx-auto p-4 mt-10 flex flex-col items-center ${darkMode ? 'dark' : ''}`}>
      {/* Header Section */}
      <div className="mb-8 text-center">
        <h1 className="mt-5 text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          RBC Onboarding Dashboard
        </h1>
        <p className="text-md text-gray-700 dark:text-gray-300">
          A one-stop solution for onboarding users efficiently.
        </p>
      </div>

      {/* Statistics Section */}
      <div className="bg-white shadow-lg rounded-lg dark:bg-gray-800 mb-8 max-w-screen-md p-6 w-full">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100 text-center">
          Assets by Technician
        </h2>
        <div className="space-y-3 mb-4">
          {statistics.assetsbyTechnician.map((technician, index) => (
            <div key={index} className="flex justify-between bg-gray-100 dark:bg-gray-700 p-3 rounded-lg shadow">
              <p className="text-gray-800 dark:text-gray-100 font-medium">{technician.technician}</p>
              <p className="text-lg font-bold text-blue-500">{technician.count}</p>
            </div>
          ))}
        </div>

        {/* Subcategories */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Assets */}
          <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
            <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">Total Assets</h3>
            <p className="text-2xl font-bold text-green-500">{statistics.totalAssets}</p>
          </div>

          {/* Defective Devices */}
          <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
            <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">Defective Devices</h3>
            <p className="text-2xl font-bold text-red-500">{statistics.defectiveDevices}</p>
          </div>
        </div>
      </div>

      {/* Feature Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-screen-md">
        {/* Central Database */}
        <div
          className="bg-white shadow-md p-6 rounded-lg dark:bg-gray-800 cursor-pointer hover:shadow-lg transition-shadow duration-300"
          onClick={() => handleClick('/central-database')}
        >
          <div className="flex items-center mb-4">
            <FontAwesomeIcon icon={faDatabase} className="text-blue-500 text-3xl" />
            <h3 className="text-lg font-semibold ml-4 text-gray-900 dark:text-gray-100">Central Database</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Central table containing all asset information.
          </p>
        </div>

        {/* Asset Management */}
        <div
          className="bg-white shadow-md p-6 rounded-lg dark:bg-gray-800 cursor-pointer hover:shadow-lg transition-shadow duration-300"
          onClick={() => handleClick('/asset-readiness')}
        >
          <div className="flex items-center mb-4">
            <FontAwesomeIcon icon={faLaptopCode} className="text-blue-500 text-3xl" />
            <h3 className="text-lg font-semibold ml-4 text-gray-900 dark:text-gray-100">Asset Management</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Manage and check individual assets.
          </p>
        </div>

        {/* Batch Management */}
        <div
          className="bg-white shadow-md p-6 rounded-lg dark:bg-gray-800 cursor-pointer hover:shadow-lg transition-shadow duration-300"
          onClick={() => handleClick('/batch')}
        >
          <div className="flex items-center mb-4">
            <FontAwesomeIcon icon={faClipboard} className="text-blue-500 text-3xl" />
            <h3 className="text-lg font-semibold ml-4 text-gray-900 dark:text-gray-100">Batch Management</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Track and manage asset batches.
          </p>
        </div>

        {/* Defective Devices */}
        <div
          className="bg-white shadow-md p-6 rounded-lg dark:bg-gray-800 cursor-pointer hover:shadow-lg transition-shadow duration-300"
          onClick={() => handleClick('/defective')}
        >
          <div className="flex items-center mb-4">
            <FontAwesomeIcon icon={faTools} className="text-blue-500 text-3xl" />
            <h3 className="text-lg font-semibold ml-4 text-gray-900 dark:text-gray-100">Defective Devices</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Track and handle defective devices.
          </p>
        </div>

        {/* Supplies Inventory */}
        <div
          className="bg-white shadow-md p-6 rounded-lg dark:bg-gray-800 cursor-pointer hover:shadow-lg transition-shadow duration-300"
          onClick={() => handleClick('/supplies-inventory')}
        >
          <div className="flex items-center mb-4">
            <FontAwesomeIcon icon={faClipboardList} className="text-blue-500 text-3xl" />
            <h3 className="text-lg font-semibold ml-4 text-gray-900 dark:text-gray-100">Supplies Inventory</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Track and manage your supplies inventory.
          </p>
        </div>

        {/* Amp Balancer */}
        <div
          className="bg-white shadow-md p-6 rounded-lg dark:bg-gray-800 cursor-pointer hover:shadow-lg transition-shadow duration-300"
          onClick={() => handleClick('/amp-balancer')}
        >
          <div className="flex items-center mb-4">
            <FontAwesomeIcon icon={faBolt} className="text-blue-500 text-3xl" />
            <h3 className="text-lg font-semibold ml-4 text-gray-900 dark:text-gray-100">Amp Balancer</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Manage and balance amp distribution effectively.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;