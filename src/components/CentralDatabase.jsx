import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faTimes, faEdit, faUser, faTrashAlt, faFileExcel, faSync, faUpload, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import { useTable, useFilters, useSortBy } from 'react-table';
import { useTableContext } from './TableContext';
import * as XLSX from 'xlsx';
import axios from 'axios';


const CentralDatabase = ({ darkMode }) => {
    const [assets, setAssets] = useState([]);
    const [editAssetId, setEditAssetId] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [filterInput, setFilterInput] = useState('');
    const [loadingAllUsers, setLoadingAllUsers] = useState(false);
    const [userInfo, setUserInfo] = useState({});
    const [selectedFile, setSelectedFile] = useState(null);
    const [view, setView] = useState('default');
    const {selectedTableName, setSelectedTableName, setSelectedTableData} = useTableContext();
    const [tableNames, setTableNames] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [tableToDelete, setTableToDelete] = useState('');

    // **ADDING: Mass edit mode state and functionality**
    const [massEditMode, setMassEditMode] = useState(false);
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
    const [massEditValues, setMassEditValues] = useState({});
    const [isSelecting, setIsSelecting] = useState(false);
    const [startCell, setStartCell] = useState(null);
    const [columnFilters, setColumnFilters] = useState({});
    const tableRef = useRef(null);

    useEffect(() => {
        fetchAssets();
    }, [selectedTableName]);

    const handleSelectChange = (e) => {
        setSelectedTableName(e.target.value);
        console.log('Selected Table:', e.target.value);
    }

    useEffect(() => {
        const fetchTableNames = async () => {
            try {
                const response = await fetch('http://sei60590.fg.rbc.com:5000/api/table-names');
                if (!response.ok){
                    throw new Error('Failed to fetch table names');
                }
                const data = await response.json();
                setTableNames(data);
                }catch (error) {
                console.error('Failed to fetch table names', error);
            }
        };
        
        fetchTableNames();
    }, []);

    
    const fetchAssets = async () => {
        try {
            const url = selectedTableName ? `http://sei60590.fg.rbc.com:5000/api/asset-by-table?table_name=${selectedTableName}` : 'http://sei60590.fg.rbc.com:5000/api/assets';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch assets');
            }
            const data = await response.json();
            setAssets(data);
        } catch (error) {
            console.error('Failed to fetch assets:', error);
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
            const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${editAssetId}`, {
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
            console.error('Failed to save asset:', error);
        }
    };

    // **ADDING: Mass edit functions**
    const toggleMassEditMode = () => {
        if (massEditMode) {
            // Exit mass edit mode
            setMassEditMode(false);
            setSelectedCells(new Set());
            setSelectedRange({ start: null, end: null });
            setMassEditValues({});
        } else {
            // Enter mass edit mode
            setMassEditMode(true);
            // Initialize mass edit values with current asset data
            const initialValues = {};
            assets.forEach(asset => {
                Object.keys(asset).forEach(key => {
                    initialValues[`${asset.id}-${key}`] = asset[key] || '';
                });
            });
            setMassEditValues(initialValues);
        }
    };

    // **ADDING: Cell selection functions**
    const getCellId = (rowId, columnId) => `${rowId}-${columnId}`;

    const handleCellClick = (rowId, columnId, event) => {
        if (!massEditMode) return;
        
        const cellId = getCellId(rowId, columnId);
        
        if (event.shiftKey && startCell) {
            // Select range
            selectRange(startCell, { rowId, columnId });
        } else {
            // Select single cell
            setSelectedCells(new Set([cellId]));
            setStartCell({ rowId, columnId });
            setSelectedRange({ start: null, end: null });
        }
    };

    const selectRange = (start, end) => {
        const startRowIndex = assets.findIndex(asset => asset.id === start.rowId);
        const endRowIndex = assets.findIndex(asset => asset.id === end.rowId);
        const columns = Object.keys(assets[0] || {});
        const startColIndex = columns.indexOf(start.columnId);
        const endColIndex = columns.indexOf(end.columnId);

        const minRow = Math.min(startRowIndex, endRowIndex);
        const maxRow = Math.max(startRowIndex, endRowIndex);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);

        const newSelectedCells = new Set();
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const rowId = assets[r].id;
                const columnId = columns[c];
                newSelectedCells.add(getCellId(rowId, columnId));
            }
        }
        setSelectedCells(newSelectedCells);
        setSelectedRange({ start, end });
    };

    // **ADDING: Mass edit input handling**
    const handleMassEditChange = (rowId, columnId, value) => {
        const cellId = getCellId(rowId, columnId);
        setMassEditValues(prev => ({
            ...prev,
            [cellId]: value
        }));

        // If multiple cells are selected, update all of them
        if (selectedCells.size > 1 && selectedCells.has(cellId)) {
            const newValues = { ...massEditValues };
            selectedCells.forEach(selectedCellId => {
                newValues[selectedCellId] = value;
            });
            setMassEditValues(newValues);
        }
    };

    // **ADDING: Keyboard navigation**
    const handleKeyDown = useCallback((event, rowId, columnId) => {
        if (!massEditMode) return;

        const columns = Object.keys(assets[0] || {});
        const currentRowIndex = assets.findIndex(asset => asset.id === rowId);
        const currentColIndex = columns.indexOf(columnId);

        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                if (currentRowIndex < assets.length - 1) {
                    const nextRowId = assets[currentRowIndex + 1].id;
                    handleCellClick(nextRowId, columnId, event);
                    // Focus next cell
                    setTimeout(() => {
                        const nextCell = document.querySelector(`[data-cell-id="${getCellId(nextRowId, columnId)}"]`);
                        if (nextCell) nextCell.focus();
                    }, 0);
                }
                break;
            case 'Tab':
                event.preventDefault();
                if (event.shiftKey) {
                    // Move left
                    if (currentColIndex > 0) {
                        const prevColumnId = columns[currentColIndex - 1];
                        handleCellClick(rowId, prevColumnId, event);
                        setTimeout(() => {
                            const prevCell = document.querySelector(`[data-cell-id="${getCellId(rowId, prevColumnId)}"]`);
                            if (prevCell) prevCell.focus();
                        }, 0);
                    }
                } else {
                    // Move right
                    if (currentColIndex < columns.length - 1) {
                        const nextColumnId = columns[currentColIndex + 1];
                        handleCellClick(rowId, nextColumnId, event);
                        setTimeout(() => {
                            const nextCell = document.querySelector(`[data-cell-id="${getCellId(rowId, nextColumnId)}"]`);
                            if (nextCell) nextCell.focus();
                        }, 0);
                    }
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (currentRowIndex > 0) {
                    const prevRowId = assets[currentRowIndex - 1].id;
                    handleCellClick(prevRowId, columnId, event);
                    setTimeout(() => {
                        const prevCell = document.querySelector(`[data-cell-id="${getCellId(prevRowId, columnId)}"]`);
                        if (prevCell) prevCell.focus();
                    }, 0);
                }
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (currentRowIndex < assets.length - 1) {
                    const nextRowId = assets[currentRowIndex + 1].id;
                    handleCellClick(nextRowId, columnId, event);
                    setTimeout(() => {
                        const nextCell = document.querySelector(`[data-cell-id="${getCellId(nextRowId, columnId)}"]`);
                        if (nextCell) nextCell.focus();
                    }, 0);
                }
                break;
            case 'ArrowLeft':
                event.preventDefault();
                if (currentColIndex > 0) {
                    const prevColumnId = columns[currentColIndex - 1];
                    handleCellClick(rowId, prevColumnId, event);
                    setTimeout(() => {
                        const prevCell = document.querySelector(`[data-cell-id="${getCellId(rowId, prevColumnId)}"]`);
                        if (prevCell) prevCell.focus();
                    }, 0);
                }
                break;
            case 'ArrowRight':
                event.preventDefault();
                if (currentColIndex < columns.length - 1) {
                    const nextColumnId = columns[currentColIndex + 1];
                    handleCellClick(rowId, nextColumnId, event);
                    setTimeout(() => {
                        const nextCell = document.querySelector(`[data-cell-id="${getCellId(rowId, nextColumnId)}"]`);
                        if (nextCell) nextCell.focus();
                    }, 0);
                }
                break;
            case 'Delete':
            case 'Backspace':
                event.preventDefault();
                // Clear selected cells
                const clearedValues = { ...massEditValues };
                selectedCells.forEach(cellId => {
                    clearedValues[cellId] = '';
                });
                setMassEditValues(clearedValues);
                break;
        }
    }, [massEditMode, assets, selectedCells, massEditValues]);

    // **ADDING: Copy/Paste functionality**
    useEffect(() => {
        const handlePaste = async (event) => {
            if (!massEditMode || selectedCells.size === 0) return;
            
            event.preventDefault();
            const clipboardData = event.clipboardData || window.clipboardData;
            const pastedData = clipboardData.getData('text');
            
            // Parse tab-separated values
            const rows = pastedData.split('\n').filter(row => row.trim());
            const parsedData = rows.map(row => row.split('\t'));
            
            // Apply pasted data to selected cells
            const selectedCellsArray = Array.from(selectedCells);
            const firstCellId = selectedCellsArray[0];
            const [firstRowId, firstColumnId] = firstCellId.split('-');
            
            const columns = Object.keys(assets[0] || {});
            const firstRowIndex = assets.findIndex(asset => asset.id === parseInt(firstRowId));
            const firstColIndex = columns.indexOf(firstColumnId);
            
            const newValues = { ...massEditValues };
            
            parsedData.forEach((row, rowOffset) => {
                row.forEach((cellValue, colOffset) => {
                    const targetRowIndex = firstRowIndex + rowOffset;
                    const targetColIndex = firstColIndex + colOffset;
                    
                    if (targetRowIndex < assets.length && targetColIndex < columns.length) {
                        const targetRowId = assets[targetRowIndex].id;
                        const targetColumnId = columns[targetColIndex];
                        const targetCellId = getCellId(targetRowId, targetColumnId);
                        newValues[targetCellId] = cellValue;
                    }
                });
            });
            
            setMassEditValues(newValues);
        };

        if (massEditMode) {
            document.addEventListener('paste', handlePaste);
            return () => document.removeEventListener('paste', handlePaste);
        }
    }, [massEditMode, selectedCells, massEditValues, assets]);

    // **ADDING: Save all changes function**
    const handleSaveAllChanges = async () => {
        try {
            const updates = [];
            
            // Group changes by asset ID
            const changesByAsset = {};
            Object.entries(massEditValues).forEach(([cellId, value]) => {
                const [rowId, columnId] = cellId.split('-');
                if (!changesByAsset[rowId]) {
                    changesByAsset[rowId] = { id: parseInt(rowId) };
                }
                changesByAsset[rowId][columnId] = value;
            });
            
            // Send updates to backend
            for (const [assetId, changes] of Object.entries(changesByAsset)) {
                const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(changes),
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to update asset ${assetId}`);
                }
            }
            
            // Refresh assets and exit mass edit mode
            await fetchAssets();
            setMassEditMode(false);
            setSelectedCells(new Set());
            setMassEditValues({});
            alert('All changes saved successfully!');
        } catch (error) {
            console.error('Failed to save changes:', error);
            alert('Failed to save some changes. Please try again.');
        }
    };

    // **ADDING: Column filter function**
    const handleColumnFilterChange = (columnId, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [columnId]: value
        }));
    };

    // **ADDING: Filter assets based on column filters**
    const filteredAssets = React.useMemo(() => {
        if (Object.keys(columnFilters).length === 0) return assets;
        
        return assets.filter(asset => {
            return Object.entries(columnFilters).every(([columnId, filterValue]) => {
                if (!filterValue) return true;
                const cellValue = asset[columnId]?.toString().toLowerCase() || '';
                return cellValue.includes(filterValue.toLowerCase());
            });
        });
    }, [assets, columnFilters]);

    const handleFetchUserInfo = async (employeeId) => {
        try {
            const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
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
                setUserInfo((prevUserInfo) => ({
                    ...prevUserInfo,
                    [employeeId]: formatUserInfo(data.output)
                }));
                updateAssetDetails(employeeId, data.output);
            } else {
                setUserInfo((prevUserInfo) => ({
                    ...prevUserInfo,
                    [employeeId]: 'No User Found'
                }));
            }
        } catch (error) {
            console.error('Failed to fetch user info:', error);
            setUserInfo((prevUserInfo) => ({
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
                setUserInfo((prevUserInfo) => ({
                    ...prevUserInfo,
                    [asset.id]: 'No User Found'
                }));
            }
        });

        await Promise.all(userInfoPromises);
        setLoadingAllUsers(false);
  
    useEffect(() => {
        handleFetchAllUserInfo()

        const interval = setInterval(() => {handleFetchAllUserInfo();}, 2 * 60 * 1000);
        return () => clearInterval(interval);
    },[])
  };

    const updateAssetDetails = async (employeeId, userInfoOutput) => {
        const loginIDMatch = userInfoOutput.match(/SamAccountName\s*:\s*(\S+)/);
        const emailIDMatch = userInfoOutput.match(/Mail\s*:\s*(\S+)/);
        const driveIDMatch = userInfoOutput.match(/HomeDirectory\s*:\s*(\S+)/);
        const firstIDMatch = userInfoOutput.match(/GivenName\s*:\s*(\S+)/);
        const lastIDMatch = userInfoOutput.match(/Surname\s*:\s*(\S+)/);

        const loginID = loginIDMatch ? loginIDMatch[1] : '';
        const emailID = emailIDMatch ? emailIDMatch[1] : '';
        const driveID = driveIDMatch ? driveIDMatch[1] : '';
        const firstID = firstIDMatch ? firstIDMatch[1] : '';
        const lastID = lastIDMatch ? lastIDMatch[1] : '';

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
                console.error('Failed to update asset with multiple fields:', error);
            }
        }
    };

    const formatUserInfo = (output) => {
        // Format the output to a more readable format
        return output
            .replace(/\r\n/g, '\n') // Normalize newlines
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
            const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/assets/${assetId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete asset');
            }
            setAssets(assets.filter((asset) => asset.id !== assetId));
        } catch (error) {
            console.error('Failed to delete asset:', error);
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
            const response = await axios.post('http://sei60590.fg.rbc.com:5000/api/upload', formData, {
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
            const response = await fetch(`http://sei60590.fg.rbc.com:5000/api/tables/${tableToDelete}`, {
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
            const tableNamesResponse = await fetch('http://sei60590.fg.rbc.com:5000/api/table-names');
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

    const columns = React.useMemo(() => {
        if (view === 'default') {
            return [
                { Header: 'Employee ID', accessor: 'employee_id' },
                { Header: 'Business Group', accessor: 'business_group' },
                { Header: 'Login ID', accessor: 'login_id' },
                { Header: 'First Name', accessor: 'first_name' },
                { Header: 'Preferred Name', accessor: 'preffered_name' },
                { Header: 'Last Name', accessor: 'last_name' },
                { Header: 'RBC Email', accessor: 'rbc_email' },
                { Header: 'Home Drive', accessor: 'home_drive' },
                { Header: 'Asset Number', accessor: 'asset_number' },
                { Header: 'School', accessor: 'school' },
                { Header: 'Business Manager', accessor: 'business_manager' },
                { Header: 'Transit', accessor: 'transit' },
                { Header: 'Location', accessor: 'location' },
                { Header: 'Phone Number', accessor: 'phone_number' },
                { Header: 'Phone Serial', accessor: 'phone_serial' },
                { Header: 'IME1', accessor: 'phone_ime1' },
                { Header: 'Phone Platform', accessor: 'phone_platform' },
                { Header: 'Onboarding Date', accessor: 'onboarding_date' },
                { Header: 'Assigned Tech', accessor: 'technician' }
            ];
        } else if (view === 'DSS') {
            return [
                { Header: 'Employee ID', accessor: 'employee_id' },
                { Header: 'Business Group', accessor: 'business_group' },
                { Header: 'Asset Number', accessor: 'asset_number' },
                { Header: 'Login ID', accessor: 'login_id' },
                { Header: 'First Name', accessor: 'first_name' },
                { Header: 'Last Name', accessor: 'last_name' },
                { Header: 'RBC Email', accessor: 'rbc_email' },
                { Header: 'Onboarding Date', accessor: 'onboarding_date' },
                { Header: 'Assigned Tech', accessor: 'technician' },
            ];
        } else if (view === 'HR') {
            return [
                { Header: 'Business Group', accessor: 'business_group' },
                { Header: 'First Name', accessor: 'first_name' },
                { Header: 'Last Name', accessor: 'last_name' },
                { Header: 'School', accessor: 'school' },
                { Header: 'Business Manager', accessor: 'business_manager' },
                { Header: 'Transit', accessor: 'transit' },
                { Header: 'Location', accessor: 'location' },
                { Header: 'Employee ID', accessor: 'employee_id' },
                { Header: 'Login ID', accessor: 'login_id' },
            ];
        } 
        else if (view === 'Mobility') {
            return [
                { Header: 'First Name', accessor: 'first_name' },
                { Header: 'Last Name', accessor: 'last_name' },
                { Header: 'Phone Number', accessor: 'phone_number' },
                { Header: 'Phone Serial', accessor: 'phone_serial' },
                { Header: 'IME1', accessor: 'phone_ime1' },
                { Header: 'Phone Platform', accessor: 'phone_platform' },
                { Header: 'Employee ID', accessor: 'employee_id' },
                { Header: 'Business Group', accessor: 'business_group' },
                { Header: 'Login ID', accessor: 'login_id' },
            ];
        }
        return [];
    }, [view, filterInput, darkMode]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable(
        {
            columns,
            data: filteredAssets, // **CHANGED: Use filtered assets instead of assets**
        },
        useFilters,
        useSortBy
    );

    return (
        <div className={` mx-auto p-4 ${darkMode ? 'dark' : ''}`}>
            <h1 className="mt-20 text-3xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">Central Database</h1>
            
            {/* **ADDING: Information bar for mass edit mode** */}
            {massEditMode && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-bold">Mass Edit Mode Active</p>
                            <p className="text-sm">
                                Use keyboard shortcuts: Tab/Shift+Tab (navigate), Enter (down), Arrow keys (navigate), 
                                Ctrl+V (paste), Delete/Backspace (clear). Click and drag to select ranges.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveAllChanges}
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                                Save All
                            </button>
                            <button
                                onClick={toggleMassEditMode}
                                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className={`bg-white shadow-lg rounded-lg dark:bg-gray-800 mb-8 p-4 w-full`}>
                <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 text-center">Actions</h2>
                <div className="flex justify-center">
                    <button
                        onClick={handleFetchAllUserInfo}
                        className={` mr-5 px-4 py-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-blue-700' : 'bg-green-500 text-white hover:bg-blue-600'}`}
                        disabled={massEditMode} // **ADDING: Disable during mass edit**
                    >
                        <FontAwesomeIcon icon={faSync} className="mr-2" />
                        {loadingAllUsers ? 'Fetching...' : 'Fetch User Data'}
                    </button>
                    <button
                        onClick={handleExportToExcel}
                        className={`px-4 py-2 rounded-md ${darkMode ? 'bg-green-600 text-gray-100 hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'}`}
                    >
                        <FontAwesomeIcon icon={faFileExcel} /> Export to Excel
                    </button>
                    <button
                        onClick={handleButtonClick}
                        className={`ml-4 px-4 py-2 rounded-md ${darkMode ? 'bg-yellow-900 text-gray-100 hover:bg-yellow-500' : 'bg-yellow-900 text-white hover:bg-yellow-600'}`}
                        disabled={massEditMode} // **ADDING: Disable during mass edit**
                    >
                        <FontAwesomeIcon icon={faUpload} className="mr-2"/>
                    </button>
                    <input
                        id="fileInput"
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    
                    {/* **ADDING: Mass Edit Button** */}
                    <button
                        onClick={toggleMassEditMode}
                        disabled={assets.length === 0}
                        className={`ml-4 px-4 py-2 rounded-md ${
                            assets.length === 0 
                                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                : massEditMode 
                                    ? 'bg-red-500 text-white hover:bg-red-600' 
                                    : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                    >
                        {massEditMode ? 'Exit Grid Mode' : 'Mass Edit'}
                    </button>
                    
                <div className="ml-10 text-center">
                    <select
                        value={view}
                        onChange={(e) => setView(e.target.value)}
                        className={`px-4 py-2 rounded-md ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                        disabled={massEditMode} // **ADDING: Disable during mass edit**
                    >
                        <option value="default">View All</option>
                        <option value="DSS">DSS View</option>
                        <option value="HR">HR View</option>
                        <option value="Mobility">Mobility View</option>
                    </select>
                </div>
                <div className="ml-10 text-center flex items-center gap-2">
                    <select 
                        value={selectedTableName}
                        onChange={handleSelectChange}
                        className={`px-4 py-2 rounded-md ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                        disabled={massEditMode} // **ADDING: Disable during mass edit**
                    >
                        <option value="">Select Year</option>
                        {tableNames.map((table) => (
                            <option key={table.table_name} value={table.table_name}>
                                {table.table_name}
                            </option>
                        ))}
                    </select>
                    {/* **ADDING: Hide delete button during mass edit** */}
                    {selectedTableName && !massEditMode && (
                        <button
                            onClick={() => handleDeleteTable(selectedTableName)}
                            className={`px-3 py-2 rounded-md ${darkMode ? 'bg-red-600 text-gray-100 hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                            title="Delete Table"
                        >
                            <FontAwesomeIcon icon={faTrashAlt} />
                        </button>
                    )}
                </div>

            </div>
            </div>

            {/* **ADDING: Improved table with sticky headers, borders, alternating rows** */}
            <div className="container w-full">
                <div className="overflow-auto max-h-[600px]" ref={tableRef}>
                    <table {...getTableProps()} className="table-auto w-full bg-white dark:bg-gray-800 border-collapse border border-gray-300 dark:border-gray-600">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10"> {/* **ADDING: Sticky headers** */}
                            {headerGroups.map(headerGroup => (
                                <React.Fragment key={headerGroup.id}>
                                    <tr {...headerGroup.getHeaderGroupProps()}>
                                        {headerGroup.headers.map(column => (
                                            <th
                                                {...column.getHeaderProps(column.getSortByToggleProps())}
                                                className="px-6 py-3 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                                            >
                                                <div className="flex items-center justify-between">
                                                    {column.render('Header')}
                                                    {/* **ADDING: Better sort icons with colors** */}
                                                    <span className="ml-2">
                                                        {column.isSorted ? (
                                                            column.isSortedDesc ? (
                                                                <FontAwesomeIcon icon={faSortDown} className="text-blue-500" />
                                                            ) : (
                                                                <FontAwesomeIcon icon={faSortUp} className="text-blue-500" />
                                                            )
                                                        ) : (
                                                            <FontAwesomeIcon icon={faSort} className="text-gray-400" />
                                                        )}
                                                    </span>
                                                </div>
                                            </th>
                                        ))}
                                        {/* **ADDING: Actions column header (hidden in mass edit)** */}
                                        {!massEditMode && (
                                            <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                    {/* **ADDING: Column filter row** */}
                                    <tr>
                                        {headerGroup.headers.map(column => (
                                            <th key={`filter-${column.id}`} className="px-2 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                                                <input
                                                    type="text"
                                                    placeholder={`Filter ${column.render('Header')}`}
                                                    value={columnFilters[column.id] || ''}
                                                    onChange={(e) => handleColumnFilterChange(column.id, e.target.value)}
                                                    className={`w-full px-2 py-1 text-xs border rounded ${
                                                        darkMode 
                                                            ? 'bg-gray-800 border-gray-600 text-gray-300 placeholder-gray-500' 
                                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                    }`}
                                                />
                                            </th>
                                        ))}
                                        {!massEditMode && (
                                            <th className="px-2 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"></th>
                                        )}
                                    </tr>
                                </React.Fragment>
                            ))}
                        </thead>
                        <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                            {rows.map((row, rowIndex) => {
                                prepareRow(row);
                                return (
                                    <tr
                                        {...row.getRowProps()}
                                        className={`
                                            border border-gray-300 dark:border-gray-600
                                            ${rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}
                                            hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150
                                            ${editAssetId === row.original.id ? 'bg-gray-200 dark:bg-gray-600' : ''}
                                        `}
                                    >
                                        {row.cells.map(cell => {
                                            const cellId = getCellId(row.original.id, cell.column.id);
                                            const isSelected = selectedCells.has(cellId);
                                            
                                            return (
                                                <td
                                                    {...cell.getCellProps()}
                                                    className={`
                                                        px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 
                                                        border border-gray-300 dark:border-gray-600
                                                        ${isSelected ? 'bg-blue-200 dark:bg-blue-600' : ''}
                                                        ${massEditMode ? 'cursor-pointer' : ''}
                                                    `}
                                                    onClick={(e) => massEditMode && handleCellClick(row.original.id, cell.column.id, e)}
                                                >
                                                    {massEditMode ? (
                                                        // **ADDING: Mass edit input cells**
                                                        <input
                                                            type="text"
                                                            data-cell-id={cellId}
                                                            value={massEditValues[cellId] || ''}
                                                            onChange={(e) => handleMassEditChange(row.original.id, cell.column.id, e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(e, row.original.id, cell.column.id)}
                                                            className={`
                                                                w-full px-2 py-1 border-none outline-none bg-transparent
                                                                ${isSelected ? 'ring-2 ring-blue-500' : ''}
                                                                focus:ring-2 focus:ring-blue-500
                                                            `}
                                                        />
                                                    ) : editAssetId === row.original.id ? (
                                                        <input
                                                            type="text"
                                                            name={cell.column.id}
                                                            value={editValues[cell.column.id] || ''}
                                                            onChange={handleChange}
                                                            className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'}`}
                                                        />
                                                    ) : (
                                                        cell.render('Cell')
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {/* **ADDING: Actions column (hidden in mass edit mode)** */}
                                        {!massEditMode && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600">
                                                {editAssetId === row.original.id ? (
                                                    <>
                                                        <button
                                                            onClick={handleSaveClick}
                                                            className={`px-3 py-1 rounded-md ${darkMode ? 'bg-green-600 text-gray-100 hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                                        >
                                                            <FontAwesomeIcon icon={faSave} />
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className={`ml-2 px-3 py-1 rounded-md ${darkMode ? 'bg-red-600 text-gray-100 hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                                        >
                                                            <FontAwesomeIcon icon={faTimes} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleEditClick(row.original)}
                                                            className={`px-3 py-1 rounded-md ${darkMode ? 'bg-blue-600 text-gray-100 hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                                                        >
                                                            <FontAwesomeIcon icon={faEdit} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(row.original.id)}
                                                            className={`ml-2 px-3 py-1 rounded-md ${darkMode ? 'bg-red-600 text-gray-100 hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                                        >
                                                            <FontAwesomeIcon icon={faTrashAlt} />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

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
                                className={`px-4 py-2 rounded-md ${darkMode ? 'bg-gray-600 text-gray-100 hover:bg-gray-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteTable}
                                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
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