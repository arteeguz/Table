import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSave, 
    faTimes, 
    faEdit, 
    faUser, 
    faTrashAlt, 
    faFileExcel, 
    faSync, 
    faUpload,
    faSortUp,
    faSortDown,
    faSort
} from '@fortawesome/free-solid-svg-icons';
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
    
    // ADDED: New state for Mass Edit functionality
    const [isMassEditMode, setIsMassEditMode] = useState(false);
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [selectedRange, setSelectedRange] = useState(null);
    const [editData, setEditData] = useState({});
    const [isSelecting, setIsSelecting] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [columnFilters, setColumnFilters] = useState({});
    const [hasChanges, setHasChanges] = useState(false);
    const tableRef = useRef(null);
    const [lastClickedCell, setLastClickedCell] = useState(null);

    useEffect(() => {
        fetchAssets();
    }, [selectedTableName]);

    // ADDED: Initialize edit data when entering mass edit mode
    useEffect(() => {
        if (isMassEditMode) {
            const initialEditData = {};
            assets.forEach(asset => {
                Object.keys(asset).forEach(key => {
                    initialEditData[`${asset.id}-${key}`] = asset[key] || '';
                });
            });
            setEditData(initialEditData);
        }
    }, [isMassEditMode, assets]);

    // ADDED: Keyboard event handler for Excel-like navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isMassEditMode) return;

            const activeElement = document.activeElement;
            if (activeElement && activeElement.dataset.cellKey) {
                const [assetId, columnId] = activeElement.dataset.cellKey.split('-');
                const currentAssetIndex = assets.findIndex(asset => asset.id.toString() === assetId);
                const currentColumnIndex = columns.findIndex(col => col.accessor === columnId);

                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        // Move down to next row
                        if (currentAssetIndex < assets.length - 1) {
                            const nextAsset = assets[currentAssetIndex + 1];
                            const nextCellKey = `${nextAsset.id}-${columnId}`;
                            const nextCell = document.querySelector(`[data-cell-key="${nextCellKey}"]`);
                            if (nextCell) nextCell.focus();
                        }
                        break;
                    case 'Tab':
                        e.preventDefault();
                        // Move right to next column or wrap to next row
                        if (e.shiftKey) {
                            // Shift+Tab: Move left
                            if (currentColumnIndex > 0) {
                                const prevColumn = columns[currentColumnIndex - 1];
                                const prevCellKey = `${assetId}-${prevColumn.accessor}`;
                                const prevCell = document.querySelector(`[data-cell-key="${prevCellKey}"]`);
                                if (prevCell) prevCell.focus();
                            }
                        } else {
                            // Tab: Move right
                            if (currentColumnIndex < columns.length - 1) {
                                const nextColumn = columns[currentColumnIndex + 1];
                                const nextCellKey = `${assetId}-${nextColumn.accessor}`;
                                const nextCell = document.querySelector(`[data-cell-key="${nextCellKey}"]`);
                                if (nextCell) nextCell.focus();
                            } else if (currentAssetIndex < assets.length - 1) {
                                // Wrap to first column of next row
                                const nextAsset = assets[currentAssetIndex + 1];
                                const firstColumn = columns[0];
                                const nextCellKey = `${nextAsset.id}-${firstColumn.accessor}`;
                                const nextCell = document.querySelector(`[data-cell-key="${nextCellKey}"]`);
                                if (nextCell) nextCell.focus();
                            }
                        }
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        if (currentAssetIndex > 0) {
                            const prevAsset = assets[currentAssetIndex - 1];
                            const prevCellKey = `${prevAsset.id}-${columnId}`;
                            const prevCell = document.querySelector(`[data-cell-key="${prevCellKey}"]`);
                            if (prevCell) prevCell.focus();
                        }
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        if (currentAssetIndex < assets.length - 1) {
                            const nextAsset = assets[currentAssetIndex + 1];
                            const nextCellKey = `${nextAsset.id}-${columnId}`;
                            const nextCell = document.querySelector(`[data-cell-key="${nextCellKey}"]`);
                            if (nextCell) nextCell.focus();
                        }
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        if (currentColumnIndex > 0) {
                            const prevColumn = columns[currentColumnIndex - 1];
                            const prevCellKey = `${assetId}-${prevColumn.accessor}`;
                            const prevCell = document.querySelector(`[data-cell-key="${prevCellKey}"]`);
                            if (prevCell) prevCell.focus();
                        }
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        if (currentColumnIndex < columns.length - 1) {
                            const nextColumn = columns[currentColumnIndex + 1];
                            const nextCellKey = `${assetId}-${nextColumn.accessor}`;
                            const nextCell = document.querySelector(`[data-cell-key="${nextCellKey}"]`);
                            if (nextCell) nextCell.focus();
                        }
                        break;
                    case 'Delete':
                    case 'Backspace':
                        // Clear selected cells
                        if (selectedCells.size > 0) {
                            const newEditData = { ...editData };
                            selectedCells.forEach(cellKey => {
                                newEditData[cellKey] = '';
                            });
                            setEditData(newEditData);
                            setHasChanges(true);
                        }
                        break;
                }
            }
        };

        // ADDED: Paste handler for Excel-like paste functionality
        const handlePaste = (e) => {
            if (!isMassEditMode) return;
            
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text');
            const rows = pasteData.split('\n').filter(row => row.trim());
            const activeElement = document.activeElement;
            
            if (activeElement && activeElement.dataset.cellKey && rows.length > 0) {
                const [startAssetId, startColumnId] = activeElement.dataset.cellKey.split('-');
                const startAssetIndex = assets.findIndex(asset => asset.id.toString() === startAssetId);
                const startColumnIndex = columns.findIndex(col => col.accessor === startColumnId);
                
                const newEditData = { ...editData };
                
                rows.forEach((row, rowOffset) => {
                    const cells = row.split('\t');
                    cells.forEach((cellValue, colOffset) => {
                        const targetAssetIndex = startAssetIndex + rowOffset;
                        const targetColumnIndex = startColumnIndex + colOffset;
                        
                        if (targetAssetIndex < assets.length && targetColumnIndex < columns.length) {
                            const targetAsset = assets[targetAssetIndex];
                            const targetColumn = columns[targetColumnIndex];
                            const cellKey = `${targetAsset.id}-${targetColumn.accessor}`;
                            newEditData[cellKey] = cellValue.trim();
                        }
                    });
                });
                
                setEditData(newEditData);
                setHasChanges(true);
            }
        };

        if (isMassEditMode) {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('paste', handlePaste);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('paste', handlePaste);
        };
    }, [isMassEditMode, assets, columns, editData, selectedCells]);

    const handleSelectChange = (e) => {
        setSelectedTableName(e.target.value);
        console.log('Selected Table:', e.target.value);
    }

    useEffect(() => {
        const fetchTableNames = async () => {
            try {
                const response = await fetch('http://se160590.fg.rbc.com:5000/api/table-names');
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
            const url = selectedTableName ? `http://se160590.fg.rbc.com:5000/api/asset-by-table?table_name=${selectedTableName}` : 'http://se160590.fg.rbc.com:5000/api/assets';
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
            console.error('Failed to save asset:', error);
        }
    };

    const handleFetchUserInfo = async (employeeId) => {
        try {
            const response = await fetch('http://se160590.fg.rbc.com:5000/api/run-powershell', {
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
            const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${assetId}`, {
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

    // ADDED: Mass Edit Mode functions
    const toggleMassEditMode = () => {
        if (isMassEditMode) {
            // Exit mass edit mode
            setIsMassEditMode(false);
            setSelectedCells(new Set());
            setSelectedRange(null);
            setEditData({});
            setHasChanges(false);
            setLastClickedCell(null);
        } else {
            // Enter mass edit mode
            setIsMassEditMode(true);
            setEditAssetId(null); // Close any individual edit
        }
    };

    // ADDED: Handle cell click for selection
    const handleCellClick = (e, assetId, columnId) => {
        if (!isMassEditMode) return;

        const cellKey = `${assetId}-${columnId}`;
        
        if (e.shiftKey && lastClickedCell) {
            // Range selection with Shift+click
            selectRange(lastClickedCell, cellKey);
        } else {
            // Single cell selection
            if (e.ctrlKey || e.metaKey) {
                // Add to selection with Ctrl+click
                const newSelection = new Set(selectedCells);
                if (newSelection.has(cellKey)) {
                    newSelection.delete(cellKey);
                } else {
                    newSelection.add(cellKey);
                }
                setSelectedCells(newSelection);
            } else {
                // Replace selection
                setSelectedCells(new Set([cellKey]));
            }
            setLastClickedCell(cellKey);
        }
    };

    // ADDED: Handle range selection
    const selectRange = (startCell, endCell) => {
        const [startAssetId, startColumnId] = startCell.split('-');
        const [endAssetId, endColumnId] = endCell.split('-');
        
        const startAssetIndex = assets.findIndex(asset => asset.id.toString() === startAssetId);
        const endAssetIndex = assets.findIndex(asset => asset.id.toString() === endAssetId);
        const startColumnIndex = columns.findIndex(col => col.accessor === startColumnId);
        const endColumnIndex = columns.findIndex(col => col.accessor === endColumnId);
        
        const minAssetIndex = Math.min(startAssetIndex, endAssetIndex);
        const maxAssetIndex = Math.max(startAssetIndex, endAssetIndex);
        const minColumnIndex = Math.min(startColumnIndex, endColumnIndex);
        const maxColumnIndex = Math.max(startColumnIndex, endColumnIndex);
        
        const rangeCells = new Set();
        for (let assetIndex = minAssetIndex; assetIndex <= maxAssetIndex; assetIndex++) {
            for (let columnIndex = minColumnIndex; columnIndex <= maxColumnIndex; columnIndex++) {
                const asset = assets[assetIndex];
                const column = columns[columnIndex];
                if (asset && column) {
                    rangeCells.add(`${asset.id}-${column.accessor}`);
                }
            }
        }
        
        setSelectedCells(rangeCells);
        setSelectedRange({ start: startCell, end: endCell });
    };

    // ADDED: Handle cell value change in mass edit mode
    const handleCellChange = (cellKey, value) => {
        const newEditData = { ...editData };
        newEditData[cellKey] = value;
        setEditData(newEditData);
        setHasChanges(true);
    };

    // ADDED: Handle batch save
    const handleBatchSave = async () => {
        try {
            const updates = [];
            
            // Group changes by asset ID
            const assetUpdates = {};
            Object.keys(editData).forEach(cellKey => {
                const [assetId, columnId] = cellKey.split('-');
                if (!assetUpdates[assetId]) {
                    assetUpdates[assetId] = { id: assetId };
                }
                assetUpdates[assetId][columnId] = editData[cellKey];
            });

            // Send updates to server
            for (const assetId in assetUpdates) {
                const updateData = assetUpdates[assetId];
                const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${assetId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updateData),
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to update asset ${assetId}`);
                }
            }

            // Refresh assets and exit mass edit mode
            await fetchAssets();
            setIsMassEditMode(false);
            setSelectedCells(new Set());
            setEditData({});
            setHasChanges(false);
            alert('All changes saved successfully!');
        } catch (error) {
            console.error('Failed to save changes:', error);
            alert('Error saving changes. Please try again.');
        }
    };

    // ADDED: Handle cancel all changes
    const handleCancelAllChanges = () => {
        setIsMassEditMode(false);
        setSelectedCells(new Set());
        setEditData({});
        setHasChanges(false);
        setSelectedRange(null);
        setLastClickedCell(null);
    };

    // ADDED: Column filter handler
    const handleColumnFilterChange = (columnId, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [columnId]: value
        }));
    };

    // ADDED: Filter assets based on column filters
    const filteredAssets = React.useMemo(() => {
        if (Object.keys(columnFilters).length === 0) return assets;
        
        return assets.filter(asset => {
            return Object.entries(columnFilters).every(([columnId, filterValue]) => {
                if (!filterValue) return true;
                const cellValue = asset[columnId];
                return cellValue && cellValue.toString().toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }, [assets, columnFilters]);

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
            data: filteredAssets, // MODIFIED: Use filtered assets instead of assets
        },
        useFilters,
        useSortBy
    );

    return (
        <div className={` mx-auto p-4 ${darkMode ? 'dark' : ''}`}>
            <h1 className="mt-20 text-3xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">Central Database</h1>
            
            {/* ADDED: Information bar for Mass Edit mode */}
            {isMassEditMode && (
                <div className="bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Mass Edit Mode Active</h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Use Ctrl+Click to select multiple cells, Shift+Click for ranges. 
                                Tab/Shift+Tab: navigate columns | Enter: next row | Arrow keys: navigate | Ctrl+V: paste
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleBatchSave}
                                disabled={!hasChanges}
                                className={`px-4 py-2 rounded-md ${
                                    hasChanges 
                                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                                        : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                }`}
                            >
                                <FontAwesomeIcon icon={faSave} className="mr-2" />
                                Save All
                            </button>
                            <button
                                onClick={handleCancelAllChanges}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                            >
                                <FontAwesomeIcon icon={faTimes} className="mr-2" />
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
                        disabled={isMassEditMode} // ADDED: Disable during mass edit
                        className={` mr-5 px-4 py-2 rounded-md ${
                            isMassEditMode 
                                ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                : darkMode ? 'bg-green-500 text-gray-100 hover:bg-blue-700' : 'bg-green-500 text-white hover:bg-blue-600'
                        }`}
                    >
                        <FontAwesomeIcon icon={faSync} className="mr-2" />
                        {loadingAllUsers ? 'Fetching...' : 'Fetch User Data'}
                    </button>
                    
                    {/* ADDED: Mass Edit Button */}
                    <button
                        onClick={toggleMassEditMode}
                        disabled={assets.length === 0} // ADDED: Disable when no data
                        className={`mr-5 px-4 py-2 rounded-md ${
                            assets.length === 0
                                ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                : isMassEditMode
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                    >
                        {isMassEditMode ? 'Exit Grid Mode' : 'Mass Edit'}
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
                <div className="ml-10 text-center">
                    <select
                        value={view}
                        onChange={(e) => setView(e.target.value)}
                        disabled={isMassEditMode} // ADDED: Disable during mass edit
                        className={`px-4 py-2 rounded-md ${
                            isMassEditMode 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'
                        }`}
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
                        disabled={isMassEditMode} // ADDED: Disable during mass edit
                        className={`px-4 py-2 rounded-md ${
                            isMassEditMode 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                    >
                        <option value="">Select Year</option>
                        {tableNames.map((table) => (
                            <option key={table.table_name} value={table.table_name}>
                                {table.table_name}
                            </option>
                        ))}
                    </select>
                    {selectedTableName && !isMassEditMode && ( // ADDED: Hide delete button during mass edit
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

            <div className="container w-full">
                {/* ADDED: Sticky table headers with improved styling */}
                <table 
                    {...getTableProps()} 
                    ref={tableRef}
                    className="table-auto overflow-scroll w-full bg-white dark:bg-gray-800 border-collapse border border-gray-300 dark:border-gray-600"
                >
                    <thead className="sticky top-0 z-10">
                        {headerGroups.map((headerGroup, groupIndex) => (
                            <React.Fragment key={groupIndex}>
                                {/* ADDED: Header row with improved sort icons */}
                                <tr {...headerGroup.getHeaderGroupProps()}>
                                    {headerGroup.headers.map((column, columnIndex) => (
                                        <th
                                            key={columnIndex}
                                            {...column.getHeaderProps(column.getSortByToggleProps())}
                                            className="px-6 py-3 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                                        >
                                            <div className="flex items-center justify-between">
                                                {column.render('Header')}
                                                {/* ADDED: Better sort icons with colors */}
                                                <span>
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
                                    {!isMassEditMode && ( // ADDED: Hide actions column during mass edit
                                        <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                                {/* ADDED: Individual column filters row */}
                                <tr>
                                    {headerGroup.headers.map((column, columnIndex) => (
                                        <th key={columnIndex} className="px-2 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600">
                                            <input
                                                type="text"
                                                placeholder={`Filter ${column.Header}...`}
                                                value={columnFilters[column.accessor] || ''}
                                                onChange={(e) => handleColumnFilterChange(column.accessor, e.target.value)}
                                                className={`w-full px-2 py-1 text-xs border rounded ${
                                                    darkMode 
                                                        ? 'bg-gray-800 border-gray-600 text-gray-300 placeholder-gray-500' 
                                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                }`}
                                            />
                                        </th>
                                    ))}
                                    {!isMassEditMode && (
                                        <th className="px-2 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600"></th>
                                    )}
                                </tr>
                            </React.Fragment>
                        ))}
                    </thead>
                    {/* ADDED: Improved table body with alternating row colors and borders */}
                    <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                        {rows.map((row, rowIndex) => {
                            prepareRow(row);
                            return (
                                <tr
                                    key={rowIndex}
                                    {...row.getRowProps()}
                                    className={`border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                        rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'
                                    } ${editAssetId === row.original.id ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
                                >
                                    {row.cells.map((cell, cellIndex) => {
                                        const cellKey = `${row.original.id}-${cell.column.id}`;
                                        const isSelected = selectedCells.has(cellKey);
                                        
                                        return (
                                            <td
                                                key={cellIndex}
                                                {...cell.getCellProps()}
                                                onClick={(e) => handleCellClick(e, row.original.id, cell.column.id)}
                                                className={`px-6 py-4 whitespace-nowrap text-sm font-medium border border-gray-300 dark:border-gray-600 ${
                                                    isSelected && isMassEditMode 
                                                        ? 'bg-blue-200 dark:bg-blue-800 ring-2 ring-blue-500' 
                                                        : 'text-gray-900 dark:text-gray-100'
                                                } ${isMassEditMode ? 'cursor-pointer' : ''}`}
                                            >
                                                {editAssetId === row.original.id && !isMassEditMode ? (
                                                    <input
                                                        type="text"
                                                        name={cell.column.id}
                                                        value={editValues[cell.column.id] || ''}
                                                        onChange={handleChange}
                                                        className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'}`}
                                                    />
                                                ) : isMassEditMode ? (
                                                    /* ADDED: Excel-like editing cells */
                                                    <input
                                                        type="text"
                                                        data-cell-key={cellKey}
                                                        value={editData[cellKey] !== undefined ? editData[cellKey] : (cell.value || '')}
                                                        onChange={(e) => handleCellChange(cellKey, e.target.value)}
                                                        className={`w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 ${
                                                            isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''
                                                        }`}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                ) : (
                                                    cell.render('Cell')
                                                )}
                                            </td>
                                        );
                                    })}
                                    {!isMassEditMode && ( // ADDED: Hide actions column during mass edit
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