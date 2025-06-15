import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faUpload, faEdit, faRefresh, faSave, faTimesCircle, faUser, faSync, faFileExcel, faPlus, faLarge, faExchange } from '@fortawesome/free-solid-svg-icons';
import { Chart, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from 'chart.js';
import * as XLSX from 'xlsx';
import { useTableContext } from './TableContext';
import { Typography } from '@material-tailwind/react';

Chart.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

const AssetManagement = ({ darkMode }) => {
    const [assets, setAssets] = useState([]);
    const [editAssetId, setEditAssetId] = useState(null);
    const [editAssetNumber, setEditAssetNumber] = useState('');
    const [editLogInId, setEditLogInId] = useState('');
    const [editEmployeeId, setEditEmployeeId] = useState('');
    const [editBusinessGroup, setEditBusinessGroup] = useState('');
    const [userInfo, setUserInfo] = useState({});
    const [loadingUserInfo, setLoadingUserInfo] = useState('');
    const [loadingAssetInfo, setLoadingAssetInfo] = useState('');
    const [loadingAllUsers, setLoadingAllUsers] = useState(false);
    const [loadingAllAssets, setLoadingAllAssets] = useState('');
    const [view, setView] = useState('list');
    const [selectedTableName, setSelectedTableName] = useTableContext();

    useEffect(() => {
        fetchAssets();
    }, []);


    //API handler functions
    const fetchAssets = async () => {
        try {
            const url = selectedTableName ? `http://sei60590.fg.rbc.com:5000/api/asset-by-tableName?table_name=${selectedTableName}` : 'http://sei60590.fg.rbc.com:5000/api/assets';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch assets');
            }
            const data = await response.json();
            setAssets(data);
        } catch (error) {
            console.error('Failed to fetch assets', error);
        }
    };

    const handleDeleteAsset = async (assetId) => {
        try {
            const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete asset');
            }
            setAssets(assets.filter(asset => asset.id !== assetId));
        } catch (error) {
            console.error('Failed to delete asset', error);
        }
    };

    const handleEditAsset = (assetId, assetNumber, loginId, businessGroup, employeeId) => {
        setEditAssetId(assetId);
        setEditAssetNumber(assetNumber);
        setEditLogInId(loginId);
        setEditBusinessGroup(businessGroup);
        setEditEmployeeId(employeeId);
    };

    const handleSaveEdit = async (assetId) => {
        try {
            const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    asset_number: editAssetNumber,
                    login_id: editLogInId,
                    business_group: editBusinessGroup,
                    employee_id: editEmployeeId}),
            });
            if (!response.ok) {
                throw new Error('Failed to save asset');
            }
            const updatedAsset = await response.json();
            setAssets(assets.map((asset) => (asset.id === assetId ? updatedAsset : asset)));
            setEditAssetId(null);
            setEditAssetNumber('');
            setEditLogInId('');
            setEditBusinessGroup('');
            setEditEmployeeId('');
        } catch (error) {
            console.error('Failed to save asset', error);
        }
    };

    const handleCancelEdit = () => {
        setEditAssetId(null);
        setEditAssetNumber('');
        setEditLogInId('');
        setEditBusinessGroup('');
        setEditEmployeeId('');
    };

    const handleStageUpdate = async (assetId, stage, status) => {
        try {
            const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}/stage`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ stage, status }),
            });
            if (!response.ok) {
                throw new Error('Failed to update stage status');
            }
            const updatedAsset = await response.json();
            setAssets(assets.map((asset) => (asset.id === updatedAsset.id ? updatedAsset : asset)));
        } catch (error) {
            console.error('Failed to update stage status', error);
        }
    };

    const handleFetchAssetInfo = async (assetId, assetName, loginId, businessGroup, ynxicDate, imagingDate, status) => {
        setLoadingAssetInfo(assetName);

        //IMAGING

        try {
            const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: `Invoke-Command -ComputerName ${assetName} -ScriptBlock { (Get-Item 'C:\\BuildLog.xml').LastWriteTime.ToString('MM/dd/yy') } `
                }),
            });
            const data = await response.json();
            imagingDate = data.output;
            status = "TRUE";

            console.log(`Asset ${assetName} was imaged on ${imagingDate}`);

            if (imagingDate){
                const updateResponse = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}/imagingDate`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ imagingDate, status }),
                });
                if (!updateResponse.ok){
                    fetchAssets();
                }else{
                    const error = await updateResponse.json();
                    console.error('error');
                }
            }
        }catch(error){
            console.error('error');
        }


        //YNXIC

        try {
            const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: `Invoke-Command -ComputerName ${assetName} -ScriptBlock {Get-ItemProperty 'HKLM:\\Software\\Application_Install\\' | Where-Object {$_.PSChildName -eq 'YNX1C' -and $_.Install_status -eq 'SUCCESS' } | Select-Object -ExpandProperty Install_date} `
                }),
            });

            const data = await response.json();
            ynxicDate = data.output.trim().split(',')[0];
            status = "TRUE";
            console.log(`Asset ${assetName} had a YNXIC Update on ${ynxicDate}`);

            if (ynxicDate){
                const updateResponse = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}/ynxicDate`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ynxicDate, status }),
                });

                if (!updateResponse.ok){
                    fetchAssets();
                }else{
                    const error = await updateResponse.json();
                    console.error('error');
                }
            }
        }catch(error){
            console.error('error')
        };


        // RSA CHECK

        try{
            const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: `Get-ADUser -Filter {SamAccountName -eq '${loginId}'} -Properties SID -Server "oak.fg.rbc.com" -SID.Value`
                }),
            });

            const data = await response.json();
            const sid = data.output.trim();
            console.log('Initializing RSA Check...');
            console.log(`User: ${loginId} SID: ${sid}`);


            if (response.ok && sid) {
                // Check the DefaultToken registry value using the SID
                const rsaResponse = await fetch('http://sei60590.fg.rbc.com:5000/api/run-rsacheck', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        script: `Invoke-Command -ComputerName ${assetName} -ScriptBlock { Get-ItemProperty -Path 'REGISTRY::HKEY_USERS\\${sid}\\Software Token\\RSA\\Software Token\\Library' | Select-Object -ExpandProperty DefaultToken }`
                    }),
                });

                const rsaData = await rsaResponse.json();
                const defaultToken = rsaData.output.trim();
                if(defaultToken){
                    console.log(`RSA Token for User ${loginId} is ${defaultToken}`);
                }else{
                    console.log(`No RSA Token found for user ${loginId} on asset ${assetName}`);
                }


                // If DefaultToken is not null, mark RSA as true
                if (defaultToken) {
                    status = "TRUE";
                    const updateResponse = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}/rsadone`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ status }),
                    });
                    if (!updateResponse.ok){
                        fetchAssets();
                    }
                } else {
                    console.error('Failed to fetch SID or RSA info');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        

        
        
        //TS BUNDLES CHECK

        try {
            const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: `Invoke-Command -ComputerName ${assetName} -ScriptBlock {Get-ItemProperty 'HKLM:\\Software\\Application_Install\\' | Where-Object { $_.Install_status -eq 'SUCCESS' } | Select-Object -ExpandProperty PSChildName}`
                }),
            });

            const data = await response.json();
            const installedApps = data.output.trim().split('\n').map(code => code.replace('\r', ''));
            const requiredApps = ['4C1F', 'YNXI', 'TC21']
            const bundleCheck = requiredApps.some(app => installedApps.includes(app));
            console.log(`TS Bundle verified. Applications installed on ${assetName}: ${installedApps}`);
            status = "TRUE";
            if (bundleCheck){
                const updateResponse = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}/tsbundle`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status }),
                });

                if (!updateResponse.ok){
                    fetchAssets();
                }else{
                    const error = await updateResponse.json();
                    console.error('error')
                }
            }
        }catch(error){
            console.error('error')
        };

        
        
        //BUSINESS BUNDLES CHECK

        try {
            const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: `Invoke-Command -ComputerName ${assetName} -ScriptBlock {Get-ItemProperty 'HKLM:\\Software\\Application_Install\\' | Where-Object { $_.Install_status -eq 'SUCCESS' } | Select-Object -ExpandProperty PSChildName}`
                }),
            });

            const data = await response.json();
            const installedApps = data.output.trim().split('\n').map(code => code.replace('\r', ''));

            const checkBusinessApps = (businessGroup, installedApps) => {
                let requiredApps = [];
                if(businessGroup.includes('RCS - Operations')) {
                    requiredApps = ['ADC3', 'ADC4']
                }
                else if (businessGroup.includes('GM - Research')){
                    requiredApps = ['333', '444', '789']
                }
                else if (businessGroup.includes('Cash Management')){
                    requiredApps = ['333', '444', '789']
                }

                console.log(`Checking apps for ${businessGroup}`, requiredApps)

                return requiredApps.every(app => installedApps.includes(app));
            }

            const bundleCheck = checkBusinessApps(businessGroup, installedApps);
            status = "TRUE";
            if (bundleCheck){
                console.log('Business Bundle verified.');
                const updateResponse = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}/bscbundle`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status }),
                });

                if (!updateResponse.ok){
                    fetchAssets();
                }else{
                    const error = await updateResponse.json();
                    console.error('error')
                }
            } else {
                console.log('Business Bundle Verification Failed. Apps not found.');
            }
        }catch(error){
            console.error('error')
        };

        setLoadingAssetInfo('');
    
};


//AD REFRESH
const handleFetchADInfo = async (employeeId) => {
    try {
        const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                script: `Get-ADUser -Filter {EmployeeID -eq '${employeeId}'} -Server "oak.fg.rbc.com" -Properties * | Select DisplayName,HomeDirectory,Surname,GivenName,Mail,SamAccountName`
            }),
        });

        const data = await response.json();

        if (response.ok && data.output) {
            setUserInfo(prevUserInfo => ({
                ...prevUserInfo,
                [employeeId]: formatUserInfo(data.output)
            }));
            updateAssetDetails(employeeId, data.output);
        } else {
            setUserInfo(prevUserInfo => ({
                ...prevUserInfo,
                [employeeId]: 'No User Found'
            }));
        }
    } catch (error) {
        console.error('Failed to fetch user info', error);
        setUserInfo(prevUserInfo => ({
            ...prevUserInfo,
            [employeeId]: 'No User Found'
        }));
    } finally {
        setLoadingUserInfo('');
    }
};

const updateAssetDetails = async (employeeId, userInfoOutput) => {
    const loginIdMatch = userInfoOutput.match(/SamAccountName\s*:\s*(\S+)/);
    const emailIdMatch = userInfoOutput.match(/Mail\s*:\s*(\S+)/);
    const driveIdMatch = userInfoOutput.match(/HomeDirectory\s*:\s*(\S+)/);
    const firstIdMatch = userInfoOutput.match(/GivenName\s*:\s*(\S+)/);
    const lastIdMatch = userInfoOutput.match(/Surname\s*:\s*(\S+)/);

    const loginID = loginIdMatch ? loginIdMatch[1] : '';
    const emailID = emailIdMatch ? emailIdMatch[1] : '';
    const driveID = driveIdMatch ? driveIdMatch[1] : '';
    const firstID = firstIdMatch ? firstIdMatch[1] : '';
    const lastID = lastIdMatch ? lastIdMatch[1] : '';

    const assetToUpdate = assets.find(asset => asset.employee_id === employeeId);
    if (assetToUpdate) {
        try {
            // Prepare the updated asset object with all fields to be updated
            const updatedAssetDetails = {
                ...assetToUpdate,
                login_id: loginID,
                first_name: firstID,
                last_name: lastID,
                rbc_email: emailID,
                home_drive: driveID
            };

            const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetToUpdate.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedAssetDetails),
            });

            if (!response.ok) {
                throw new Error('Failed to update asset');
            }

            const updatedAsset = await response.json();
            setAssets(assets.map((asset) => (asset.id === assetToUpdate.id ? updatedAsset : asset)));
        } catch (error) {
            console.error('Failed to update asset with multiple fields', error);
        }
    }
};


// AD fetching Automation
const handleFetchUserInfo = async (loginId) => {
    setLoadingUserInfo(loginId);
    try {
        const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                script: `Get-ADUser -Filter {SamAccountName -eq '${loginId}'} -Server "oak.fg.rbc.com" -Properties * | Select DisplayName,HomeDirectory,Surname,GivenName,SamAccountName,Mail,EmployeeID`
            }),
        });

        const data = await response.json();

        if (response.ok && data.output) {
            setUserInfo(prevUserInfo => ({
                ...prevUserInfo,
                [loginId]: formatUserInfo(data.output)
            }));
        } else {
            console.error('Failed to fetch user info');
        }
    } catch (error) {
        console.error('Failed to fetch user info', error);
    } finally {
        setLoadingUserInfo('');
    }
};

const handleFetchAllUserInfo = async () => {
    setLoadingAllUsers(true);

    const userInfoPromises = assets.map(async (asset) => {
        if (asset.login_id) {
            await handleFetchUserInfo(asset.login_id);
        } else {
            console.error('Failed to fetch user info');
        }
    });

    await Promise.all(userInfoPromises);
    setLoadingAllUsers(false);
};

const handleFetchAllDeviceInfo = async () => {
    setLoadingAllAssets(true);

    const assetInfoPromises = assets.map(async (asset) => {
        if(asset.asset_number){
        // const handleFetchAssetInfo = async (assetId, assetName, loginId, businessGroup, ynxicDate, imagingDate, status)
        await handleFetchAssetInfo(asset.id, asset.asset_number, asset.login_id, asset.business_group);
    } else {
        console.log('Failed to fetch user info');
    }

    await Promise.all(assetInfoPromises);
    setLoadingAllAssets(false);
    });
}


//Statistics

const calculateStats = () => {
    const stats = {
        total_assets: assets.length,
        imaging_complete: 0,
        ynxic_complete: 0,
        business_bundles_complete: 0,
        rsa_complete: 0,
        fully_complete: 0,
        incomplete: 0
    };

    assets.forEach(asset => {
        if (asset.imaging_complete) stats.imaging_complete++;
        if (asset.ynxic_complete) stats.ynxic_complete++;
        if (asset.business_bundles_complete) stats.business_bundles_complete++;
        if (asset.rsa_complete) stats.rsa_complete++;
        if (asset.imaging_complete && asset.ynxic_complete && asset.business_bundles_complete && asset.rsa_complete){
            stats.fully_complete++;
        }else {
            stats.incomplete++;
        }
    });

    return stats;
};

const handleExportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(assets);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, "assets.xlsx");
};

const formatUserInfo = (output) => {
    return output
        .replace(/\\r\\n/g, '\n') // Normalize newlines
        .split('\n') // Split into lines
        .map(line => line.trim()) // Trim each line
        .filter(line => line.length > 0) // Remove empty lines
        .join('\n'); // Join back into a single string
};

const stats = calculateStats();

const toggleViewMode = () => {
    setViewMode((prevMode) => (prevMode === 'list' ? 'grid' : 'list'));
};

const getBackgroundColor = (asset) => {
    const completedTasks = ['imaging_complete', 'ynxic_complete', 'business_bundles_complete', 'rsa_complete'].filter(task => asset[task]).length;
    if (completedTasks === 2 || completedTasks === 3) {
        return 'bg-orange-200 dark:bg-orange-400';
    } else if (completedTasks === 4) {
        return 'bg-green-200 dark:bg-green-400';
    } else {
        return 'bg-gray-100 dark:bg-gray-800';
    }
};


return (
    <div className={`container mx-auto p-4 ${viewMode === 'list' ? 'max-w-screen-lg' : 'max-w-screen-x1'} ${darkMode ? 'dark' : ''}`}>
        <h1 className="mt-10 text-3xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">Asset Readiness</h1>

        {/* Statistics Section */}
        <div className={`bg-white shadow-lg rounded-lg dark:bg-gray-800 mb-8 ${viewMode === 'list' ? 'max-w-screen-lg' : 'max-w-screen-x1'} p-6 w-full`}>
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100 text-center">
                Assets Statistics
            </h2>


            {/* Subcategories */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">

                {/* Imaged */}
                <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
                    <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">Assets Imaged</h3>
                    <p className="text-2xl font-bold text-blue-500">{stats.imaging_complete}</p>
                </div>


                {/* YNXIC */}
                <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
                    <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">Assets YNXIC</h3>
                    <p className="text-2xl font-bold text-blue-500">{stats.ynxic_complete}</p>
                </div>


                {/* Bundles */}
                <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
                    <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">App Bundles</h3>
                    <p className="text-2xl font-bold text-blue-500">{stats.business_bundles_complete}</p>
                </div>

                {/* RSA */}
                <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
                    <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">RSA Configured</h3>
                    <p className="text-2xl font-bold text-blue-500">{stats.rsa_complete}</p>
                </div>

            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Complete */}
                <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
                    <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">Assets Ready</h3>
                    <p className="text-2xl font-bold text-green-500">{stats.fully_complete}</p>
                </div>

                {/* Incomplete */}
                <div className="bg-gray-100 dark:bg-gray-700 shadow p-4 rounded-lg text-center">
                    <h3 className="text-md font-semibold mb-1 text-gray-900 dark:text-gray-100">Incomplete</h3>
                    <p className="text-2xl font-bold text-red-500">{stats.incomplete}</p>
                </div>
            </div>
        </div>




        {/* Export to Excel Button */}
        <div className={`bg-white shadow-lg rounded-lg dark:bg-gray-800 mb-8 ${viewMode === 'list' ? 'max-w-screen-lg' : 'max-w-screen-x1'} p-4 w-full`}>
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 text-center">Actions</h2>
            <div className="flex justify-center">
                <button
                    onClick={handleFetchAllUserInfo}
                    className={`px-4 py-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-blue-700' : 'bg-green-500 text-white hover:bg-blue-600'}`}
                    disabled={loadingAllUsers}
                >
                    <FontAwesomeIcon icon={faSync} className="mr-2" />
                    {loadingAllUsers ? 'Fetching...' : 'Fetch User Data'}
                </button>

                <button
                    onClick={handleFetchAllDeviceInfo}
                    className={`ml-4 px-4 py-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-blue-700' : 'bg-green-500 text-white hover:bg-blue-600'}`}
                    disabled={loadingAllAssets}
                >
                    <FontAwesomeIcon icon={faLaptop} className="mr-2" />
                    {loadingAllAssets ? 'Fetching...' : 'Fetch Asset Data'}
                </button>


                <button
                    onClick={handleExportToExcel}
                    className="ml-4 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                    <FontAwesomeIcon icon={faFileExcel} className="mr-2" />Export to Excel
                </button>
                <button
                    onClick={toggleViewMode}
                    className={`ml-4 px-4 py-2 rounded-md ${darkMode ? 'bg-yellow-600 text-gray-100 hover:bg-yellow-700' : 'bg-yellow-800 text-white hover:bg-yellow-600'}`}
                >
                    <FontAwesomeIcon icon={viewMode === 'list' ? faThLarge : faThList} className="mr-2" />
                    {viewMode === 'list' ? 'Grid View' : 'List View'}
                </button>
            </div>
        </div>

        {assets.length === 0 ? (
            <p className="text-center text-gray-600 ${darkMode ? 'text-gray-300' : 'text-gray-600'}">No assets available.</p>
        ) : (
            <div className={`grid ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-4'} gap-4`}>
                {assets.map((asset) => (
                    /* ${getBackgroundColor(asset)}  bg-gray-100 dark:bg-gray-800    */
                    <div key={asset.id} className={`p-4 rounded-lg shadow-lg rounded-lg ${getBackgroundColor(asset)} `}>
                        <div className="flex justify-between items-center">
                            <div>
                                {editAssetId === asset.id ? (
                                    <>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Asset Number
                                            <input
                                                type="text"
                                                value={editAssetNumber}
                                                onChange={(e) => setEditAssetNumber(e.target.value)}
                                                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'}`}
                                            />
                                        </label>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
                                            Login ID
                                            <input
                                                type="text"
                                                value={editLogInId}
                                                onChange={(e) => setEditLogInId(e.target.value)}
                                                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'}`}
                                            />
                                        </label>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
                                            Business Group
                                            <input
                                                type="text"
                                                value={editBusinessGroup}
                                                onChange={(e) => setEditBusinessGroup(e.target.value)}
                                                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'}`}
                                            />
                                        </label>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
                                            Employee ID
                                            <input
                                                type="text"
                                                value={editEmployeeId}
                                                onChange={(e) => setEditEmployeeId(e.target.value)}
                                                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'}`}
                                            />
                                        </label>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{asset.asset_number}</p>
                                        <p className="text-md text-gray-900 dark:text-gray-100">Login ID: {asset.login_id}</p>
                                        <p className="text-md text-gray-900 dark:text-gray-100">Business Group: {asset.business_group}</p>
                                        <p className="text-md text-gray-900 dark:text-gray-100">Batch Date: {new Date(asset.batch_date).toLocaleDateString()}</p>
                                        <p className="text-md text-gray-900 dark:text-gray-100">Technician: {asset.technician}</p>
                                    </>
                                )}
                        {/* Stage Checkboxes */}
                        <div className="mt-2 space-y-2">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={asset.imaging_complete}
                                    onChange={(e) => handleStageUpdate(asset.id, 'imaging_complete', e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-100">Imaging - {asset.imaging_date}</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={asset.ynxic_complete}
                                    onChange={(e) => handleStageUpdate(asset.id, 'ynxic_complete', e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-100">YNXIC - {asset.ynxic_date}</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={asset.rsa_complete}
                                    onChange={(e) => handleStageUpdate(asset.id, 'rsa_complete', e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="mb-5text-gray-900 dark:text-gray-100">RSA Token</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={asset.business_bundles_complete}
                                    onChange={(e) => handleStageUpdate(asset.id, 'business_bundles_complete', e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-100">TS Bundle</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={asset.bundle_check}
                                    onChange={(e) => handleStageUpdate(asset.id, 'bundle_check', e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-gray-100">Business Bundle</span>
                            </label>
                            {userInfo[asset.login_id] && (
                                <pre className="mt-5 bg-gray-200 p-2 rounded-lg shadow-sm dark:bg-gray-900 dark:text-gray-300 whitespace-pre-wrap">
                                    {userInfo[asset.login_id]}
                                </pre>
                            )}
                        </div>
                        </div>
                        <div className="flex space-x-2">
                            {editAssetId === asset.id ? (
                                <>
                                    <button
                                        onClick={() => handleSaveEdit(asset.id)}
                                        className={`px-2 py-1 rounded-md ${darkMode ? 'bg-green-600 text-gray-100 hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                    >
                                        <FontAwesomeIcon icon={faSave} />
                                    </button>
                                    <button
                                        onClick={handleCancelEdit}
                                        className={`px-2 py-1 rounded-md ${darkMode ? 'bg-gray-600 text-gray-100 hover:bg-gray-700' : 'bg-gray-500 text-white hover:bg-gray-600'}`}
                                    >
                                        <FontAwesomeIcon icon={faTimesCircle} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleFetchUserInfo(asset.login_id)}
                                        className={`p-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-yellow-700' : 'bg-green-500 text-white hover:bg-yellow-600'}`}
                                    >
                                        <FontAwesomeIcon icon={faUser} />
                                        {loadingUserInfo === asset.login_id && '...'}
                                    </button>

                                    
                                    <button
                                        onClick={() => handleFetchAssetInfo(asset.id, asset.asset_number, asset.login_id, asset.business_group)}
                                        className={`p-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-yellow-700' : 'bg-green-500 text-white hover:bg-yellow-600'}`}
                                    >
                                        <FontAwesomeIcon icon={faLaptop} />
                                        {loadingAssetInfo === asset.asset_number && '...'}
                                    </button>


                                    <button
                                        onClick={() => handleEditAsset(asset.id, asset.asset_number, asset.login_id, asset.business_group, asset.employee_id)}
                                        className={`px-2 py-1 rounded-md ${darkMode ? 'bg-blue-600 text-gray-100 hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                                    >
                                        <FontAwesomeIcon icon={faEdit} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteAsset(asset.id)}
                                        className={`px-2 py-1 rounded-md ${darkMode ? 'bg-red-600 text-gray-100 hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                    >
                                        <FontAwesomeIcon icon={faTrashAlt} />
                                    </button>

                                    <button
                                        onClick={() => handleFetchADInfo(asset.employee_id)}
                                        className={`p-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-yellow-700' : 'bg-green-500 text-white hover:bg-yellow-600'}`}
                                    >
                                        <FontAwesomeIcon icon={faRefresh} />
                                        {loadingUserInfo === asset.employee_id && '...'}
                                    </button>

                                </>
                            )}
                        </div>
                    </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);
};

export default AssetManagement;