import React, { useState } from 'react';

const AssetDetails = ({ darkMode }) => {
  const [hostname, setHostname] = useState('');
  const [loadingAssetDetails, setLoadingAssetDetails] = useState(false);
  const [loadingApplicationList, setLoadingApplicationList] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handleFetchAssetDetails = async () => {
    setLoadingAssetDetails(true);
    setError('');
    setOutput('');

    try {
      const script = `Get-CimInstance -ClassName Win32_ComputerSystem -ComputerName '${hostname}' | Select-Object PSComputerName, Manufacturer, SystemFamily,Model, TotalPhysicalMemory, UserName, SystemType, Domain, BootupState, PrimaryOwnerName, Status | Convert-Json -Compress`;
      const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script }),
      });

      const data = await response.json();

      if (data.success) {
        const formattedOutput = formatJsonOutput(data.output);
        setOutput(formattedOutput);
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to execute the script');
    } finally {
      setLoadingAssetDetails(false);
    }
  };

  const handleFetchApplicationList = async () => {
    setLoadingApplicationList(true);
    setError('');
    setOutput('');

    try {
      const script = `$apps = Get-ItemProperty HKLM:\\Software\\Application_Install\\* | Where-Object { $_APPLICATION_NAME -and $_VERSION_NUMBER } | Select-Object APPLICATION_NAME, VERSION_NUMBER | ConvertTo-Json -Compress; $apps`;
      const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script }),
      });

      const data = await response.json();

      if (data.success) {
        const formattedOutput = formatApplicationList(data.output);
        setOutput(formattedOutput);
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to execute the script');
    } finally {
      setLoadingApplicationList(false);
    }
  };

  const formatJsonOutput = (jsonString) => {
    try {
      const parsedJson = JSON.parse(jsonString);
      return Object.keys(parsedJson)
        .map(key => `${key}: ${parsedJson[key]}`)
        .join('\n');
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return jsonString; // Return original string if parsing fails
    }
  };

  const formatApplicationList = (jsonData) => {
    try {
      const apps = JSON.parse(jsonData);
      return apps.map(app => {
        return Object.keys(app)
          .map(key => `${key}: ${app[key]}`)
          .join('\n');
      }).join('\n\n');
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return jsonData; // Return original string if parsing fails
    }
  };

  return (
    <div className={`container mx-auto p-6 max-w-4xl ${darkMode ? 'dark' : ''}`}>
      <h1 className="text-2xl font-bold mb-4 mt-20 text-center text-gray-500 dark:text-gray-100">
        Asset Information
      </h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Hostname
            </label>
            <input
              type="text"
              className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'
              }"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex justify-between">
          <button
            onClick={handleFetchAssetDetails}
            className="flex items-center bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              loadingAssetDetails ? 'cursor-not-allowed' : ''
            }"
            disabled={loadingAssetDetails}
          >
            {loadingAssetDetails ? 'Fetching...' : 'Fetch Asset Details'}
          </button>
          <button
            onClick={handleFetchApplicationList}
            className="flex items-center bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              loadingApplicationList ? 'cursor-not-allowed' : ''
            }"
            disabled={loadingApplicationList}
          >
            {loadingApplicationList ? 'Fetching...' : 'Fetch Application List'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      {output && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-200 dark:text-gray-300">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Asset Information</h2>
          </div>
          <div className="p-6">
            <pre className="whitespace-pre-wrap text-gray-900 dark:text-gray-300">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetDetails;