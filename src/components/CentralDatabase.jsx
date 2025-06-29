import React, { useEffect, useState, useContext, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faTimes, faEdit, faUser, faTrashAlt, faFileExcel, faSync, faUpload, faTableCells, faExclamationTriangle, faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
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
    const [loadingUserInfo, setLoadingUserInfo] = useState('');
    const [userInfo, setUserInfo] = useState({});
    const [selectedFile, setSelectedFile] = useState(null);
    const [view, setView] = useState('default');
    const {selectedTableName, setSelectedTableName, setSelectedTableData} = useTableContext();
    const [tableNames, setTableNames] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [tableToDelete, setTableToDelete] = useState('');
    
    // ADDED: Mass Edit Mode states
    const [isMassEditMode, setIsMassEditMode] = useState(false);
    const [massEditValues, setMassEditValues] = useState({});
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [selectionStart, setSelectionStart] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [focusedCell, setFocusedCell] = useState(null);
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

    // ADDED: Mass Edit Mode Functions
    const toggleMassEditMode = () => {
        if (isMassEditMode) {
            // Exit mass edit mode
            setIsMassEditMode(false);
            setMassEditValues({});
            setSelectedCells(new Set());
            setSelectionStart(null);
            setFocusedCell(null);
        } else {
            // Enter mass edit mode
            setIsMassEditMode(true);
            // Initialize massEditValues with current asset values
            const initialValues = {};
            assets.forEach(asset => {
                initialValues[asset.id] = { ...asset };
            });
            setMassEditValues(initialValues);
        }
    };

    const handleMassEditChange = (assetId, columnId, value) => {
        if (!assetId || !columnId) return; // ADDED: Safety check
        setMassEditValues(prev => ({
            ...prev,
            [assetId]: {
                ...prev[assetId],
                [columnId]: value
            }
        }));
    };

    const handleCellClick = (rowIndex, columnId, e) => {
        if (!isMassEditMode) return;
        
        const cellKey = `${rowIndex}-${columnId}`;
        
        if (e.shiftKey && selectionStart) {
            // Range selection
            const [startRow, startCol] = selectionStart.split('-');
            const startRowIdx = parseInt(startRow);
            const endRowIdx = rowIndex;
            
            const newSelection = new Set();
            const minRow = Math.min(startRowIdx, endRowIdx);
            const maxRow = Math.max(startRowIdx, endRowIdx);
            
            for (let i = minRow; i <= maxRow; i++) {
                newSelection.add(`${i}-${columnId}`);
            }
            
            setSelectedCells(newSelection);
        } else {
            // Single cell selection
            setSelectedCells(new Set([cellKey]));
            setSelectionStart(cellKey);
        }
        
        setFocusedCell(cellKey);
    };

    const handleCellMouseDown = (rowIndex, columnId) => {
        if (!isMassEditMode) return;
        setIsSelecting(true);
        const cellKey = `${rowIndex}-${columnId}`;
        setSelectionStart(cellKey);
        setSelectedCells(new Set([cellKey]));
    };

    const handleCellMouseEnter = (rowIndex, columnId) => {
        if (!isMassEditMode || !isSelecting) return;
        
        const cellKey = `${rowIndex}-${columnId}`;
        const [startRow, startCol] = selectionStart.split('-');
        const startRowIdx = parseInt(startRow);
        const endRowIdx = rowIndex;
        
        const newSelection = new Set();
        const minRow = Math.min(startRowIdx, endRowIdx);
        const maxRow = Math.max(startRowIdx, endRowIdx);
        
        for (let i = minRow; i <= maxRow; i++) {
            newSelection.add(`${i}-${columnId}`);
        }
        
        setSelectedCells(newSelection);
    };

    const handleCellMouseUp = () => {
        setIsSelecting(false);
    };

    const handleKeyDown = (e, rowIndex, columnId) => {
        if (!isMassEditMode) return;
        
        const currentCellKey = `${rowIndex}-${columnId}`;
        let newRowIndex = rowIndex;
        let newColumnId = columnId;
        
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                newRowIndex = Math.min(rowIndex + 1, (rows?.length || 1) - 1);
                break;
            case 'Tab':
                e.preventDefault();
                const colIndex = columns.findIndex(col => col.accessor === columnId);
                if (e.shiftKey) {
                    const prevColIndex = Math.max(colIndex - 1, 0);
                    newColumnId = columns[prevColIndex].accessor;
                } else {
                    const nextColIndex = Math.min(colIndex + 1, columns.length - 1);
                    newColumnId = columns[nextColIndex].accessor;
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                newRowIndex = Math.max(rowIndex - 1, 0);
                break;
            case 'ArrowDown':
                e.preventDefault();
                newRowIndex = Math.min(rowIndex + 1, (rows?.length || 1) - 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                const leftColIndex = columns.findIndex(col => col.accessor === columnId);
                const prevColIdx = Math.max(leftColIndex - 1, 0);
                newColumnId = columns[prevColIdx].accessor;
                break;
            case 'ArrowRight':
                e.preventDefault();
                const rightColIndex = columns.findIndex(col => col.accessor === columnId);
                const nextColIdx = Math.min(rightColIndex + 1, columns.length - 1);
                newColumnId = columns[nextColIdx].accessor;
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                // Clear selected cells
                selectedCells.forEach(cellKey => {
                    const [rowIdx, colId] = cellKey.split('-');
                    const asset = rows[parseInt(rowIdx)].original;
                    handleMassEditChange(asset.id, colId, '');
                });
                break;
        }
        
        if (e.key === 'Enter' || e.key === 'Tab' || e.key.startsWith('Arrow')) {
            const newCellKey = `${newRowIndex}-${newColumnId}`;
            setFocusedCell(newCellKey);
            setSelectedCells(new Set([newCellKey]));
            
            // Focus the new cell
            setTimeout(() => {
                const newCell = document.querySelector(`[data-cell-key="${newCellKey}"] input`);
                if (newCell) {
                    newCell.focus();
                }
            }, 0);
        }
    };

    const handlePaste = (e) => {
        if (!isMassEditMode) return;
        e.preventDefault();
        
        const pastedData = e.clipboardData.getData('text');
        const rows = pastedData.split('\n').filter(row => row.trim());
        const pastedCells = rows.map(row => row.split('\t'));
        
        if (focusedCell) {
            const [startRow, startCol] = focusedCell.split('-');
            const startRowIdx = parseInt(startRow);
            const colIndex = columns.findIndex(col => col.accessor === startCol);
            
            pastedCells.forEach((row, rowOffset) => {
                row.forEach((value, colOffset) => {
                    const targetRowIdx = startRowIdx + rowOffset;
                    const targetColIdx = colIndex + colOffset;
                    
                    if (targetRowIdx < (rows?.length || 0) && targetColIdx < (columns?.length || 0)) {
                        const asset = rows[targetRowIdx]?.original;
                        const columnId = columns[targetColIdx]?.accessor;
                        if (asset && columnId) {
                            handleMassEditChange(asset.id, columnId, value);
                        }
                    }
                });
            });
        }
    };

    const handleSaveAllChanges = async () => {
        try {
            const updatePromises = Object.entries(massEditValues).map(async ([assetId, values]) => {
                const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${assetId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(values),
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to update asset ${assetId}`);
                }
                
                return response.json();
            });
            
            await Promise.all(updatePromises);
            alert('All changes saved successfully!');
            toggleMassEditMode();
            fetchAssets(); // Refresh the data
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Failed to save some changes. Please try again.');
        }
    };

    // ADDED: Column Filter Component
    const DefaultColumnFilter = ({ column: { filterValue, setFilter } }) => {
        return (
            <input
                value={filterValue || ''}
                onChange={e => setFilter(e.target.value || undefined)}
                placeholder={`Search...`}
                className={`w-full px-2 py-1 text-sm border rounded ${
                    darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                }`}
                onClick={e => e.stopPropagation()}
            />
        );
    };

    const columns = React.useMemo(() => {
        const baseColumns = [];
        
        if (view === 'default') {
            baseColumns.push(
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Preferred Name', accessor: 'preffered_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'RBC Email', accessor: 'rbc_email', Filter: DefaultColumnFilter },
                { Header: 'Home Drive', accessor: 'home_drive', Filter: DefaultColumnFilter },
                { Header: 'Asset Number', accessor: 'asset_number', Filter: DefaultColumnFilter },
                { Header: 'School', accessor: 'school', Filter: DefaultColumnFilter },
                { Header: 'Business Manager', accessor: 'business_manager', Filter: DefaultColumnFilter },
                { Header: 'Transit', accessor: 'transit', Filter: DefaultColumnFilter },
                { Header: 'Location', accessor: 'location', Filter: DefaultColumnFilter },
                { Header: 'Phone Number', accessor: 'phone_number', Filter: DefaultColumnFilter },
                { Header: 'Phone Serial', accessor: 'phone_serial', Filter: DefaultColumnFilter },
                { Header: 'IME1', accessor: 'phone_ime1', Filter: DefaultColumnFilter },
                { Header: 'Phone Platform', accessor: 'phone_platform', Filter: DefaultColumnFilter },
                { Header: 'Onboarding Date', accessor: 'onboarding_date', Filter: DefaultColumnFilter },
                { Header: 'Assigned Tech', accessor: 'technician', Filter: DefaultColumnFilter }
            );
        } else if (view === 'DSS') {
            baseColumns.push(
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'Asset Number', accessor: 'asset_number', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'RBC Email', accessor: 'rbc_email', Filter: DefaultColumnFilter },
                { Header: 'Onboarding Date', accessor: 'onboarding_date', Filter: DefaultColumnFilter },
                { Header: 'Assigned Tech', accessor: 'technician', Filter: DefaultColumnFilter },
            );
        } else if (view === 'HR') {
            baseColumns.push(
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'School', accessor: 'school', Filter: DefaultColumnFilter },
                { Header: 'Business Manager', accessor: 'business_manager', Filter: DefaultColumnFilter },
                { Header: 'Transit', accessor: 'transit', Filter: DefaultColumnFilter },
                { Header: 'Location', accessor: 'location', Filter: DefaultColumnFilter },
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
            );
        } 
        else if (view === 'Mobility') {
            baseColumns.push(
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'Phone Number', accessor: 'phone_number', Filter: DefaultColumnFilter },
                { Header: 'Phone Serial', accessor: 'phone_serial', Filter: DefaultColumnFilter },
                { Header: 'IME1', accessor: 'phone_ime1', Filter: DefaultColumnFilter },
                { Header: 'Phone Platform', accessor: 'phone_platform', Filter: DefaultColumnFilter },
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
            );
        }
        
        return baseColumns;
    }, [view]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable(
        {
            columns,
            data: isMassEditMode ? (Object.keys(massEditValues).length > 0 ? Object.values(massEditValues) : assets) : assets,
        },
        useFilters,
        useSortBy
    );

    // ADDED: useEffect for keyboard event listeners
    useEffect(() => {
        if (isMassEditMode) {
            document.addEventListener('mouseup', handleCellMouseUp);
            document.addEventListener('paste', handlePaste);
            
            return () => {
                document.removeEventListener('mouseup', handleCellMouseUp);
                document.removeEventListener('paste', handlePaste);
            };
        }
    }, [isMassEditMode]);

    return (
        <div className={`p-4 ${darkMode ? 'dark' : ''}`} ref={tableRef}>
            <h1 className="mt-20 text-3xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">Central Database</h1>
            
            <div className={`bg-white shadow-lg rounded-lg dark:bg-gray-800 mb-8 p-4 w-full`}>
                <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 text-center">Actions</h2>
                <div className="flex justify-center">
                    <button
                        onClick={handleFetchAllUserInfo}
                        className={` mr-5 px-4 py-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-blue-700' : 'bg-green-500 text-white hover:bg-blue-600'}`}
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
                    
                    {/* ADDED: Mass Edit Button */}
                    <button
                        onClick={toggleMassEditMode}
                        disabled={assets.length === 0 || loadingAllUsers}
                        className={`ml-4 px-4 py-2 rounded-md ${
                            assets.length === 0 || loadingAllUsers
                                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                : isMassEditMode
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : darkMode
                                        ? 'bg-purple-600 text-gray-100 hover:bg-purple-700'
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                    >
                        <FontAwesomeIcon icon={faTableCells} className="mr-2"/>
                        {isMassEditMode ? 'Exit Grid Mode' : 'Mass Edit'}
                    </button>
                    
                <div className="ml-10 text-center">
                    <select
                        value={view}
                        onChange={(e) => setView(e.target.value)}
                        disabled={isMassEditMode} // ADDED: Disable during mass edit
                        className={`px-4 py-2 rounded-md ${
                            isMassEditMode 
                                ? 'cursor-not-allowed opacity-50' 
                                : ''
                        } ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
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
                                ? 'cursor-not-allowed opacity-50' 
                                : ''
                        } ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                        <option value="">Select Year</option>
                        {tableNames.map((table) => (
                            <option key={table.table_name} value={table.table_name}>
                                {table.table_name}
                            </option>
                        ))}
                    </select>
                    {/* MODIFIED: Hide delete button during mass edit */}
                    {selectedTableName && !isMassEditMode && (
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

            {/* ADDED: Mass Edit Info Bar */}
            {isMassEditMode && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                            <div>
                                <p className="font-bold">Mass Edit Mode Active</p>
                                <p className="text-sm">Click cells to edit. Use Tab/Enter to navigate. Ctrl+V to paste. Click and drag to select multiple cells.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveAllChanges}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                <FontAwesomeIcon icon={faSave} className="mr-2" />
                                Save All
                            </button>
                            <button
                                onClick={toggleMassEditMode}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                <FontAwesomeIcon icon={faTimes} className="mr-2" />
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODIFIED: Added overflow container and sticky headers */}
            <div className="w-full overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="min-w-full inline-block align-middle">
                    <div className="overflow-hidden">
                        <table 
                            {...getTableProps()} 
                            className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
                            style={{ borderSpacing: 0 }}
                        >
                    <thead className="sticky top-0 z-10">
                        {headerGroups.map((headerGroup, index) => (
                            <React.Fragment key={`header-group-${index}`}>
                                <tr {...headerGroup.getHeaderGroupProps()}>
                                    {headerGroup.headers.map((column, colIndex) => (
                                        <th
                                            key={`header-${colIndex}`}
                                            {...column.getHeaderProps(column.getSortByToggleProps())}
                                            className="px-6 py-3 border border-gray-200 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 dark:border-gray-600"
                                        >
                                            <div className="flex items-center justify-between">
                                                {column.render('Header')}
                                                {/* MODIFIED: Enhanced sort icons with colors */}
                                                <span className="ml-2">
                                                    {column.isSorted
                                                        ? column.isSortedDesc
                                                            ? <FontAwesomeIcon icon={faSortDown} className="text-blue-500" />
                                                            : <FontAwesomeIcon icon={faSortUp} className="text-blue-500" />
                                                        : <FontAwesomeIcon icon={faSort} className="text-gray-400" />}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                    {/* MODIFIED: Hide actions column in mass edit mode */}
                                    {!isMassEditMode && (
                                        <th className="px-6 py-3 border border-gray-200 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 dark:border-gray-600">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                                {/* ADDED: Filter row */}
                                <tr>
                                    {headerGroup.headers.map((column, colIndex) => (
                                        <th
                                            key={`filter-${colIndex}`}
                                            className="px-6 py-2 border border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                                        >
                                            {column.canFilter ? column.render('Filter') : null}
                                        </th>
                                    ))}
                                    {/* MODIFIED: Hide actions column filter in mass edit mode */}
                                    {!isMassEditMode && (
                                        <th className="px-6 py-2 border border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600"></th>
                                    )}
                                </tr>
                            </React.Fragment>
                        ))}
                    </thead>
                    <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                        {rows.map((row, rowIndex) => {
                            prepareRow(row);
                            if (!row.original) return null; // ADDED: Safety check
                            return (
                                <tr
                                    key={row.original.id || rowIndex}
                                    {...row.getRowProps()}
                                    className={`
                                        ${editAssetId === row.original.id ? 'bg-gray-200 dark:bg-gray-600' : ''}
                                        ${rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
                                        hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                                    `}
                                >
                                    {row.cells.map((cell, cellIndex) => {
                                        const cellKey = `${rowIndex}-${cell.column.id}`;
                                        const isSelected = selectedCells.has(cellKey);
                                        const isFocused = focusedCell === cellKey;
                                        
                                        return (
                                            <td
                                                key={`cell-${cellIndex}`}
                                                {...cell.getCellProps()}
                                                className={`
                                                    px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 
                                                    border border-gray-200 dark:border-gray-600
                                                    ${isSelected ? 'bg-blue-100 dark:bg-blue-800' : ''}
                                                    ${isFocused ? 'ring-2 ring-blue-500' : ''}
                                                    ${isMassEditMode ? 'cursor-cell' : ''}
                                                `}
                                                data-cell-key={cellKey}
                                                onMouseDown={() => handleCellMouseDown(rowIndex, cell.column.id)}
                                                onMouseEnter={() => handleCellMouseEnter(rowIndex, cell.column.id)}
                                                onClick={(e) => handleCellClick(rowIndex, cell.column.id, e)}
                                            >
                                                {isMassEditMode ? (
                                                    <input
                                                        type="text"
                                                        value={massEditValues[row.original.id]?.[cell.column.id] ?? ''}
                                                        onChange={(e) => handleMassEditChange(row.original.id, cell.column.id, e.target.value)}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, cell.column.id)}
                                                        className={`w-full px-2 py-1 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                                            darkMode ? 'text-gray-100' : 'text-gray-900'
                                                        }`}
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
                                    {/* MODIFIED: Hide actions column in mass edit mode */}
                                    {!isMassEditMode && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600">
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