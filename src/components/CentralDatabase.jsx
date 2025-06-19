import React, { useEffect, useState, useContext, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faTimes, faEdit, faUser, faTrashAlt, faFileExcel, faSync, faUpload, faSort, faSortUp, faSortDown, faFilter, faSearch } from '@fortawesome/free-solid-svg-icons';
import { useTable, useFilters, useSortBy, useGlobalFilter } from 'react-table'
import { useTableContext } from './TableContext';
import * as XLSX from 'xlsx';
import axios from 'axios';

// Default column filter component
function DefaultColumnFilter({
    column: { filterValue, preFilteredRows, setFilter },
}) {
    const count = preFilteredRows.length

    return (
        <input
            value={filterValue || ''}
            onChange={e => {
                setFilter(e.target.value || undefined)
            }}
            placeholder="Search..."
            className="w-full px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
        />
    )
}

// Select column filter for specific columns
function SelectColumnFilter({
    column: { filterValue, setFilter, preFilteredRows, id },
}) {
    const options = useMemo(() => {
        const options = new Set()
        preFilteredRows.forEach(row => {
            options.add(row.values[id])
        })
        return [...options.values()]
    }, [id, preFilteredRows])

    return (
        <select
            value={filterValue}
            onChange={e => {
                setFilter(e.target.value || undefined)
            }}
            className="w-full px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
        >
            <option value="">All</option>
            {options.map((option, i) => (
                <option key={i} value={option}>
                    {option}
                </option>
            ))}
        </select>
    )
}

// Global filter component
function GlobalFilter({
    preGlobalFilteredRows,
    globalFilter,
    setGlobalFilter,
    darkMode
}) {
    const count = preGlobalFilteredRows.length

    return (
        <div className="flex items-center justify-center">
            <FontAwesomeIcon icon={faSearch} className="mr-2 text-gray-500" />
            <input
                value={globalFilter || ''}
                onChange={e => {
                    setGlobalFilter(e.target.value || undefined)
                }}
                placeholder={`Search all ${count} records...`}
                className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode 
                        ? 'bg-gray-800 border-gray-600 text-gray-300' 
                        : 'bg-white border-gray-300 text-gray-900'
                }`}
                style={{ width: 'min(90vw, 400px)' }}
            />
        </div>
    )
}

const CentralDatabase = ({ darkMode }) => {
    const [assets, setAssets] = useState([]);
    const [editAssetId, setEditAssetId] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [loadingAllUsers, setLoadingAllUsers] = useState(false);
    const [userInfo, setUserInfo] = useState({});
    const [selectedFile, setSelectedFile] = useState(null);
    const [view, setView] = useState('default');
    const {selectedTableName, setSelectedTableName, setSelectedTableData} = useTableContext();
    const [tableNames, setTableNames] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [tableToDelete, setTableToDelete] = useState('');

    useEffect(() => {
        fetchAssets();
    }, [selectedTableName]);

    const handleSelectChange = (e) => {
        setSelectedTableName(e.target.value);
        console.log('Selected Table:', e.target.value);
    };

    useEffect(() => {
        const fetchTableNames = async () => {
            try {
                const response = await fetch('http://se160590.fg.rbc.com:5000/api/table-names');
                if (!response.ok) {
                    throw new Error('Failed to fetch table names');
                }
                const data = await response.json();
                setTableNames(data);
            } catch (error) {
                console.error('Failed to fetch table names', error);
            }
        };
        
        fetchTableNames();
    }, []);

    
    const fetchAssets = async () => {
        try {
            const url = selectedTableName ? `http://se160590.fg.rbc.com:5000/api/asset-by-tableName?table_name=${selectedTableName}` : 'http://se160590.fg.rbc.com:5000/api/assets';
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

    const handleEditClick = (asset) => {
        setEditAssetId(asset.id);
        setEditValues({
            asset_number: asset.asset_number,
            login_id: asset.login_id,
            first_name: asset.first_name,
            last_name: asset.last_name,
            business_group: asset.business_group,
            employee_id: asset.employee_id,
            rbc_email: asset.rbc_email,
            home_drive: asset.home_drive,
            technician: asset.technician

        });
    };

    const handleSaveClick = async () => {
        try {
            const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${editAssetId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editValues),
            });
            if (!response.ok) {
                throw new Error('Failed to save asset');
            }
            const updatedAsset = await response.json();
            setAssets(assets.map((asset) => (asset.id === editAssetId ? updatedAsset : asset)));
            setEditAssetId(null);
            setEditValues({});
        } catch (error) {
            console.error('Failed to save asset', error);
        }
    };

    const handleFetchUserInfo = async (employeeId) => {
        try {
            const response = await fetch(`http://se160590.fg.rbc.com:5000/api/run-powershell`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: `Get-ADUser -Filter {EmployeeID -eq '${employeeId}'} -Server "oak.fg.rbc.com" -Properties * | Select DisplayName,HomeDirectory,Surname,GivenName,SamAccountName,Mail,EmployeeID`
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

    const handleFetchAllUserInfo = async () => {
        setLoadingAllUsers(true);

        const userInfoPromises = assets.map(async (asset) => {
            if (asset.employee_id) {
                await handleFetchUserInfo(asset.employee_id);
            } else {
                setUserInfo(prevUserInfo => ({
                    ...prevUserInfo,
                    [asset.id]: 'No User Found'
                }));
            }
        });

        await Promise.all(userInfoPromises);
        setLoadingAllUsers(false);
  
    useEffect(() => {
        handleFetchAllUserInfo();

        const interval = setInterval(() => {handleFetchAllUserInfo()}, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [])
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

                const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${assetToUpdate.id}`, {
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

    const formatUserInfo = (output) => {
        // Format the output to a more readable format
        return output
            .replace(/\\r\\n/g, '\n') // Normalize newlines
            .split('\n') // Split into lines
            .map(line => line.trim()) // Trim each line
            .filter(line => line.length > 0) // Remove empty lines
            .join('\n'); // Join back into a single string
    };

    const handleCancelEdit = () => {
        setEditAssetId(null);
        setEditValues({});
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditValues({
            ...editValues,
            [name]: value
        });
    };

    const handleDelete = async (assetId) => {
        try {
            const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${assetId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete asset');
            }
            setAssets(assets.filter((asset) => asset.id !== assetId));
        } catch (error) {
            console.error('Failed to delete asset', error);
        }
    };

    const handleExportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(assets);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        XLSX.writeFile(wb, 'assets.xlsx');
    };

    const handleFileUpload = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://se160590.fg.rbc.com:5000/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            console.log('File uploaded successfully:', response.data);
            fetchAssets(); // Refresh assets after upload
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    const handleButtonClick = () => {
        document.getElementById('fileInput').click();
    };
        
    const handleDeleteTable = (tableName) => {
        setTableToDelete(tableName);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteTable = async () => {
        try {
            const response = await fetch(`http://se160590.fg.rbc.com:5000/api/tables/${tableToDelete}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete table');
            }
            
            const result = await response.json();
            console.log(result.message);
            
            // Reset state and refresh data
            setSelectedTableName('');
            setShowDeleteConfirm(false);
            setTableToDelete('');
            
            // Refresh table names and assets
            const tableNamesResponse = await fetch('http://se160590.fg.rbc.com:5000/api/table-names');
            const tableNamesData = await tableNamesResponse.json();
            setTableNames(tableNamesData);
            
            fetchAssets();
        } catch (error) {
            console.error('Failed to delete table:', error);
            alert('Failed to delete table. Please try again.');
        }
    };

    const cancelDeleteTable = () => {
        setShowDeleteConfirm(false);
        setTableToDelete('');
    };

    // Enhanced columns with filters - Excel-like compact design
    const columns = React.useMemo(() => {
        if (view === 'default') {
            return [
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: SelectColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Preferred Name', accessor: 'preferred_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'RBC Email', accessor: 'rbc_email', Filter: DefaultColumnFilter },
                { Header: 'Home Drive', accessor: 'home_drive', Filter: DefaultColumnFilter },
                { Header: 'Asset Number', accessor: 'asset_number', Filter: DefaultColumnFilter },
                { Header: 'School', accessor: 'school', Filter: DefaultColumnFilter },
                { Header: 'Business Manager', accessor: 'business_manager', Filter: DefaultColumnFilter },
                { Header: 'Transit', accessor: 'transit', Filter: DefaultColumnFilter },
                { Header: 'Location', accessor: 'location', Filter: SelectColumnFilter },
                { Header: 'Phone Number', accessor: 'phone_number', Filter: DefaultColumnFilter },
                { Header: 'Phone Serial', accessor: 'phone_serial', Filter: DefaultColumnFilter },
                { Header: 'IMEI', accessor: 'phone_imei', Filter: DefaultColumnFilter },
                { Header: 'Phone Platform', accessor: 'phone_platform', Filter: SelectColumnFilter },
                { Header: 'Onboarding Date', accessor: 'onboarding_date', Filter: DefaultColumnFilter },
                { Header: 'Assigned Tech', accessor: 'technician', Filter: SelectColumnFilter }
            ];
        } else if (view === 'DSS') {
            return [
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: SelectColumnFilter },
                { Header: 'Asset Number', accessor: 'asset_number', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'RBC Email', accessor: 'rbc_email', Filter: DefaultColumnFilter },
                { Header: 'Onboarding Date', accessor: 'onboarding_date', Filter: DefaultColumnFilter },
                { Header: 'Assigned Tech', accessor: 'technician', Filter: SelectColumnFilter },
            ];
        } else if (view === 'HR') {
            return [
                { Header: 'Business Group', accessor: 'business_group', Filter: SelectColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'School', accessor: 'school', Filter: DefaultColumnFilter },
                { Header: 'Business Manager', accessor: 'business_manager', Filter: DefaultColumnFilter },
                { Header: 'Transit', accessor: 'transit', Filter: DefaultColumnFilter },
                { Header: 'Location', accessor: 'location', Filter: SelectColumnFilter },
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
            ];
        } 
        else if (view === 'Mobility') {
            return [
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'Phone Number', accessor: 'phone_number', Filter: DefaultColumnFilter },
                { Header: 'Phone Serial', accessor: 'phone_serial', Filter: DefaultColumnFilter },
                { Header: 'IMEI', accessor: 'phone_imei', Filter: DefaultColumnFilter },
                { Header: 'Phone Platform', accessor: 'phone_platform', Filter: SelectColumnFilter },
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: SelectColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
            ];
        }
        return [];
    }, [view]);

    // Default column configuration
    const defaultColumn = React.useMemo(
        () => ({
            Filter: DefaultColumnFilter,
        }),
        []
    )

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
        state,
        preGlobalFilteredRows,
        setGlobalFilter,
    } = useTable(
        {
            columns,
            data: assets,
            defaultColumn,
        },
        useFilters,
        useGlobalFilter,
        useSortBy
    );

    return (
        <div className={`min-h-screen w-full ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
            {/* Global Responsive Styles */}
            <style>
                {`
                /* Responsive font and spacing system */
                :root {
                    --responsive-text-xs: clamp(0.7rem, 0.5vw + 0.6rem, 0.85rem);
                    --responsive-text-sm: clamp(0.8rem, 0.7vw + 0.7rem, 1rem);
                    --responsive-text-base: clamp(0.9rem, 1vw + 0.8rem, 1.2rem);
                    --responsive-text-lg: clamp(1.1rem, 1.5vw + 1rem, 1.5rem);
                    --responsive-text-xl: clamp(1.3rem, 2vw + 1.2rem, 2rem);
                    --responsive-text-2xl: clamp(1.6rem, 2.5vw + 1.4rem, 2.5rem);
                    --responsive-spacing-1: clamp(0.25rem, 0.5vw + 0.2rem, 0.5rem);
                    --responsive-spacing-2: clamp(0.5rem, 1vw + 0.4rem, 1rem);
                    --responsive-spacing-3: clamp(0.75rem, 1.5vw + 0.6rem, 1.5rem);
                    --responsive-spacing-4: clamp(1rem, 2vw + 0.8rem, 2rem);
                }

                /* Excel-like scrollbars */
                .excel-scrollbar::-webkit-scrollbar {
                    width: clamp(8px, 1vw, 16px);
                    height: clamp(8px, 1vw, 16px);
                }
                .excel-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }
                .excel-scrollbar::-webkit-scrollbar-thumb {
                    background: #c1c1c1;
                    border-radius: 4px;
                }
                .excel-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #a8a8a8;
                }
                .excel-scrollbar::-webkit-scrollbar-corner {
                    background: #f1f1f1;
                }

                /* Responsive table cells */
                .responsive-cell {
                    font-size: var(--responsive-text-xs);
                    padding: var(--responsive-spacing-1) var(--responsive-spacing-2);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Button responsive sizing */
                .responsive-btn {
                    font-size: var(--responsive-text-sm);
                    padding: var(--responsive-spacing-1) var(--responsive-spacing-2);
                }

                /* Ensure minimum visibility at high zoom */
                @media (max-height: 400px) {
                    .header-section {
                        padding: 0.5rem;
                    }
                    .title {
                        font-size: 1.2rem !important;
                        margin-bottom: 0.5rem;
                    }
                    .table-container {
                        height: calc(100vh - 150px) !important;
                    }
                }
                `}
            </style>

            {/* Centered Header Section */}
            <div className="header-section w-full bg-white dark:bg-gray-800 shadow-md border-b-2 border-gray-200 dark:border-gray-700" style={{ padding: 'var(--responsive-spacing-4)' }}>
                <div className="flex flex-col items-center justify-center w-full max-w-none">
                    {/* Title - Always Centered */}
                    <h1 
                        className="title font-bold text-center text-gray-900 dark:text-gray-100 mb-4"
                        style={{ fontSize: 'var(--responsive-text-2xl)' }}
                    >
                        Central Database
                    </h1>
                    
                    {/* Action Buttons - Centered and Responsive */}
                    <div className="w-full max-w-6xl">
                        <div className="flex flex-wrap justify-center items-center gap-2 mb-4">
                            <button
                                onClick={handleFetchAllUserInfo}
                                className={`responsive-btn rounded transition-colors ${darkMode ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'}`}
                            >
                                <FontAwesomeIcon icon={faSync} className="mr-1" />
                                {loadingAllUsers ? 'Fetching...' : 'Fetch Data'}
                            </button>
                            <button
                                onClick={handleExportToExcel}
                                className={`responsive-btn rounded transition-colors ${darkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                            >
                                <FontAwesomeIcon icon={faFileExcel} className="mr-1" />
                                Export
                            </button>
                            <button
                                onClick={handleButtonClick}
                                className={`responsive-btn rounded transition-colors ${darkMode ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                            >
                                <FontAwesomeIcon icon={faUpload} className="mr-1"/>
                                Upload
                            </button>
                            <input
                                id="fileInput"
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                            <select
                                value={view}
                                onChange={(e) => setView(e.target.value)}
                                className={`responsive-btn rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                            >
                                <option value="default">View All</option>
                                <option value="DSS">DSS_ZTE</option>
                                <option value="HR">HR</option>
                                <option value="Mobility">Mobility</option>
                            </select>
                            <div className="flex items-center gap-1">
                                <select
                                    value={selectedTableName}
                                    onChange={handleSelectChange}
                                    className={`responsive-btn rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                                >
                                    <option value="">All Tables</option>
                                    {tableNames.map((table) => (
                                        <option key={table.table_name} value={table.table_name}>
                                            {table.table_name}
                                        </option>
                                    ))}
                                </select>
                                {selectedTableName && (
                                    <button
                                        onClick={() => handleDeleteTable(selectedTableName)}
                                        className={`responsive-btn rounded transition-colors ${darkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                        title="Delete Table"
                                    >
                                        <FontAwesomeIcon icon={faTrashAlt} />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Global Search - Centered */}
                        <div className="flex justify-center">
                            <GlobalFilter
                                preGlobalFilteredRows={preGlobalFilteredRows}
                                globalFilter={state.globalFilter}
                                setGlobalFilter={setGlobalFilter}
                                darkMode={darkMode}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Full Width Responsive Table Container */}
            <div 
                className="table-container w-full"
                style={{ 
                    height: 'calc(100vh - 200px)',
                    minHeight: '300px',
                    padding: 'var(--responsive-spacing-2)'
                }}
            >
                <div className="w-full h-full border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                    <div className="excel-scrollbar w-full h-full overflow-auto">
                        <table 
                            {...getTableProps()} 
                            className="w-full border-collapse"
                            style={{ 
                                tableLayout: 'auto',
                                minWidth: '100%'
                            }}
                        >
                            <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-700">
                                {headerGroups.map(headerGroup => (
                                    <React.Fragment key={headerGroup.id}>
                                        {/* Header Row */}
                                        <tr {...headerGroup.getHeaderGroupProps()}>
                                            {headerGroup.headers.map(column => (
                                                <th
                                                    {...column.getHeaderProps()}
                                                    className="border-r border-b border-gray-300 dark:border-gray-600 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600"
                                                    style={{
                                                        fontSize: 'var(--responsive-text-xs)',
                                                        padding: 'var(--responsive-spacing-1) var(--responsive-spacing-2)',
                                                        minWidth: 'fit-content'
                                                    }}
                                                >
                                                    <div 
                                                        {...column.getSortByToggleProps()}
                                                        className="flex items-center justify-between cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500 px-1 py-1 rounded"
                                                    >
                                                        <span className="font-medium">{column.render('Header')}</span>
                                                        <span className="ml-1">
                                                            {column.isSorted
                                                                ? column.isSortedDesc
                                                                    ? <FontAwesomeIcon icon={faSortDown} className="text-blue-500" />
                                                                    : <FontAwesomeIcon icon={faSortUp} className="text-blue-500" />
                                                                : <FontAwesomeIcon icon={faSort} className="text-gray-400" />}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="border-r border-b border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-600 text-left font-semibold text-gray-700 dark:text-gray-300 sticky right-0 z-30"
                                                style={{
                                                    fontSize: 'var(--responsive-text-xs)',
                                                    padding: 'var(--responsive-spacing-1) var(--responsive-spacing-2)',
                                                    minWidth: '100px'
                                                }}
                                            >
                                                Actions
                                            </th>
                                        </tr>
                                        {/* Filter Row */}
                                        <tr className="bg-gray-50 dark:bg-gray-700">
                                            {headerGroup.headers.map(column => (
                                                <th key={column.id} className="border-r border-b border-gray-300 dark:border-gray-600" style={{ padding: 'var(--responsive-spacing-1)' }}>
                                                    {column.canFilter ? column.render('Filter') : null}
                                                </th>
                                            ))}
                                            <th className="border-r border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 sticky right-0 z-30" style={{ padding: 'var(--responsive-spacing-1)' }}>
                                                {/* Actions column - no filter */}
                                            </th>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </thead>
                            <tbody {...getTableBodyProps()}>
                                {rows.map((row, index) => {
                                    prepareRow(row);
                                    return (
                                        <tr
                                            {...row.getRowProps()}
                                            className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'} hover:bg-blue-50 dark:hover:bg-gray-700 ${editAssetId === row.original.id ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                                        >
                                            {row.cells.map(cell => (
                                                <td
                                                    {...cell.getCellProps()}
                                                    className="responsive-cell border-r border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                                >
                                                    {editAssetId === row.original.id ? (
                                                        <input
                                                            type="text"
                                                            name={cell.column.id}
                                                            value={editValues[cell.column.id] || ''}
                                                            onChange={handleChange}
                                                            className={`w-full px-1 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'}`}
                                                            style={{ 
                                                                fontSize: 'var(--responsive-text-xs)',
                                                                minWidth: '60px'
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="overflow-hidden text-ellipsis" title={cell.value}>
                                                            {cell.render('Cell')}
                                                        </div>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="responsive-cell border-r border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 sticky right-0 z-10">
                                                {editAssetId === row.original.id ? (
                                                    <div className="flex space-x-1">
                                                        <button
                                                            onClick={handleSaveClick}
                                                            className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                                            style={{ fontSize: 'var(--responsive-text-xs)' }}
                                                        >
                                                            <FontAwesomeIcon icon={faSave} />
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-500 text-white hover:bg-gray-600'}`}
                                                            style={{ fontSize: 'var(--responsive-text-xs)' }}
                                                        >
                                                            <FontAwesomeIcon icon={faTimes} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex space-x-1">
                                                        <button
                                                            onClick={() => handleEditClick(row.original)}
                                                            className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                                                            style={{ fontSize: 'var(--responsive-text-xs)' }}
                                                        >
                                                            <FontAwesomeIcon icon={faEdit} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(row.original.id)}
                                                            className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                                            style={{ fontSize: 'var(--responsive-text-xs)' }}
                                                        >
                                                            <FontAwesomeIcon icon={faTrashAlt} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* Results Summary */}
                <div 
                    className="mt-2 text-center bg-gray-100 dark:bg-gray-700 py-1 rounded text-gray-600 dark:text-gray-400"
                    style={{ fontSize: 'var(--responsive-text-xs)' }}
                >
                    Showing {rows.length} of {preGlobalFilteredRows.length} results
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                            Confirm Delete
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">
                            Are you sure you want to delete table "{tableToDelete}"? This will permanently remove all associated assets.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={cancelDeleteTable}
                                className={`px-4 py-2 rounded-md ${darkMode ? 'bg-gray-600 text-gray-100 hover:bg-gray-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'} transition-colors`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteTable}
                                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CentralDatabase;