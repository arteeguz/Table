import React, { useEffect, useState, useContext, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// NEW FEATURE: Additional icons for enhanced table features
import { faSave, faTimes, faEdit, faUser, faTrashAlt, faFileExcel, faSync, faUpload, faTable, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import { useTable, useFilters, useSortBy } from 'react-table';
import { useTableContext } from './TableContext';
import * as XLSX from 'xlsx';
import axios from 'axios';

// NEW FEATURE: Individual Column Filter Component
const DefaultColumnFilter = ({ column: { filterValue, setFilter } }) => {
    return (
        <input
            value={filterValue || ''}
            onChange={e => setFilter(e.target.value || undefined)}
            placeholder="Filter..."
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            onClick={e => e.stopPropagation()}
        />
    );
};

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

    // NEW FEATURE: Excel-like Mass Edit State Variables
    const [isGridEditMode, setIsGridEditMode] = useState(false);
    const [gridData, setGridData] = useState([]);
    const [selectedCell, setSelectedCell] = useState({ rowIndex: null, columnId: null });
    const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
    const [isSelecting, setIsSelecting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const inputRefs = useRef({});

    useEffect(() => {
        fetchAssets();
    }, [selectedTableName]);

    // NEW FEATURE: Excel-like Mass Edit - Global Mouse Events
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setIsDragging(false);
        };

        if (isGridEditMode) {
            document.addEventListener('mouseup', handleGlobalMouseUp);
            return () => {
                document.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    }, [isGridEditMode]);

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

    // NEW FEATURE: Excel-like Mass Edit Functions START
    const toggleGridEditMode = () => {
        if (isGridEditMode) {
            // Exit grid mode
            setIsGridEditMode(false);
            setSelectedCell({ rowIndex: null, columnId: null });
            setSelectedRange({ start: null, end: null });
            setIsSelecting(false);
            setIsDragging(false);
        } else {
            // Enter grid mode
            setIsGridEditMode(true);
            setGridData([...assets]);
        }
    };

    const handleGridCellChange = (rowIndex, columnId, value) => {
        const updatedGridData = [...gridData];
        
        // If there's a selected range, apply change to all cells in range
        if (selectedRange.start && selectedRange.end) {
            const { start, end } = selectedRange;
            const startRow = Math.min(start.rowIndex, end.rowIndex);
            const endRow = Math.max(start.rowIndex, end.rowIndex);
            const columns = getCurrentColumns();
            const startColIndex = Math.min(
                columns.findIndex(col => col.accessor === start.columnId),
                columns.findIndex(col => col.accessor === end.columnId)
            );
            const endColIndex = Math.max(
                columns.findIndex(col => col.accessor === start.columnId),
                columns.findIndex(col => col.accessor === end.columnId)
            );

            for (let r = startRow; r <= endRow; r++) {
                for (let c = startColIndex; c <= endColIndex; c++) {
                    const colId = columns[c].accessor;
                    updatedGridData[r] = {
                        ...updatedGridData[r],
                        [colId]: value
                    };
                }
            }
        } else {
            // Single cell change
            updatedGridData[rowIndex] = {
                ...updatedGridData[rowIndex],
                [columnId]: value
            };
        }
        
        setGridData(updatedGridData);
    };

    const handleCellClick = (rowIndex, columnId, event) => {
        if (event.shiftKey && selectedCell.rowIndex !== null) {
            // Shift+click for range selection
            setSelectedRange({
                start: selectedCell,
                end: { rowIndex, columnId }
            });
        } else {
            // Regular click
            setSelectedCell({ rowIndex, columnId });
            setSelectedRange({ start: null, end: null });
            setIsSelecting(false);
        }
        
        // Focus the input
        const inputKey = `${rowIndex}-${columnId}`;
        if (inputRefs.current[inputKey]) {
            inputRefs.current[inputKey].focus();
        }
    };

    const handleMouseDown = (rowIndex, columnId, event) => {
        if (event.button === 0) { // Left mouse button
            setIsDragging(true);
            setSelectedCell({ rowIndex, columnId });
            setSelectedRange({ start: { rowIndex, columnId }, end: null });
        }
    };

    const handleMouseEnter = (rowIndex, columnId) => {
        if (isDragging && selectedRange.start) {
            setSelectedRange({
                ...selectedRange,
                end: { rowIndex, columnId }
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const isCellInRange = (rowIndex, columnId) => {
        if (!selectedRange.start || !selectedRange.end) return false;
        
        const { start, end } = selectedRange;
        const startRow = Math.min(start.rowIndex, end.rowIndex);
        const endRow = Math.max(start.rowIndex, end.rowIndex);
        
        const columns = getCurrentColumns();
        const startColIndex = Math.min(
            columns.findIndex(col => col.accessor === start.columnId),
            columns.findIndex(col => col.accessor === end.columnId)
        );
        const endColIndex = Math.max(
            columns.findIndex(col => col.accessor === start.columnId),
            columns.findIndex(col => col.accessor === end.columnId)
        );
        const currentColIndex = columns.findIndex(col => col.accessor === columnId);

        return rowIndex >= startRow && rowIndex <= endRow && 
               currentColIndex >= startColIndex && currentColIndex <= endColIndex;
    };

    const handleKeyDown = (e, rowIndex, columnId) => {
        const currentColumns = getCurrentColumns();
        const currentColumnIndex = currentColumns.findIndex(col => col.accessor === columnId);
        
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                // Move to next row, same column
                if (rowIndex < gridData.length - 1) {
                    handleCellClick(rowIndex + 1, columnId, e);
                }
                break;
            case 'Tab':
                e.preventDefault();
                // Move to next column
                if (e.shiftKey) {
                    // Shift+Tab: move backwards
                    if (currentColumnIndex > 0) {
                        handleCellClick(rowIndex, currentColumns[currentColumnIndex - 1].accessor, e);
                    } else if (rowIndex > 0) {
                        handleCellClick(rowIndex - 1, currentColumns[currentColumns.length - 1].accessor, e);
                    }
                } else {
                    // Tab: move forwards
                    if (currentColumnIndex < currentColumns.length - 1) {
                        handleCellClick(rowIndex, currentColumns[currentColumnIndex + 1].accessor, e);
                    } else if (rowIndex < gridData.length - 1) {
                        handleCellClick(rowIndex + 1, currentColumns[0].accessor, e);
                    }
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (rowIndex > 0) {
                    handleCellClick(rowIndex - 1, columnId, e);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (rowIndex < gridData.length - 1) {
                    handleCellClick(rowIndex + 1, columnId, e);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (currentColumnIndex > 0) {
                    handleCellClick(rowIndex, currentColumns[currentColumnIndex - 1].accessor, e);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (currentColumnIndex < currentColumns.length - 1) {
                    handleCellClick(rowIndex, currentColumns[currentColumnIndex + 1].accessor, e);
                }
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                // Clear selected cells
                if (selectedRange.start && selectedRange.end) {
                    handleGridCellChange(rowIndex, columnId, '');
                } else {
                    handleGridCellChange(rowIndex, columnId, '');
                }
                break;
        }
    };

    const handlePaste = (e, rowIndex, columnId) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text');
        const rows = pasteData.split('\n').filter(row => row.trim() !== '');
        const currentColumns = getCurrentColumns();
        const currentColumnIndex = currentColumns.findIndex(col => col.accessor === columnId);
        
        let updatedGridData = [...gridData];
        
        rows.forEach((row, rowOffset) => {
            const cells = row.split('\t');
            
            cells.forEach((cell, cellOffset) => {
                const targetRowIndex = rowIndex + rowOffset;
                const targetColumnIndex = currentColumnIndex + cellOffset;
                
                if (targetRowIndex < updatedGridData.length && targetColumnIndex < currentColumns.length) {
                    const targetColumnId = currentColumns[targetColumnIndex].accessor;
                    updatedGridData[targetRowIndex] = {
                        ...updatedGridData[targetRowIndex],
                        [targetColumnId]: cell.trim()
                    };
                }
            });
        });
        
        setGridData(updatedGridData);
        
        // Update selection range based on pasted data
        const endRowIndex = Math.min(rowIndex + rows.length - 1, gridData.length - 1);
        const maxCells = Math.max(...rows.map(row => row.split('\t').length));
        const endColumnIndex = Math.min(currentColumnIndex + maxCells - 1, currentColumns.length - 1);
        
        setSelectedRange({
            start: { rowIndex, columnId },
            end: { rowIndex: endRowIndex, columnId: currentColumns[endColumnIndex].accessor }
        });
    };

    const handleInput = (e, rowIndex, columnId) => {
        // Apply input to selected range if exists
        handleGridCellChange(rowIndex, columnId, e.target.value);
    };

    const saveGridChanges = async () => {
        try {
            const promises = gridData.map(async (asset) => {
                const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${asset.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(asset),
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to update asset ${asset.id}`);
                }
                return response.json();
            });

            await Promise.all(promises);
            setAssets([...gridData]);
            setIsGridEditMode(false);
            alert('All changes saved successfully!');
        } catch (error) {
            console.error('Failed to save grid changes:', error);
            alert('Failed to save some changes. Please try again.');
        }
    };

    const cancelGridChanges = () => {
        setIsGridEditMode(false);
        setGridData([]);
        setSelectedCell({ rowIndex: null, columnId: null });
        setSelectedRange({ start: null, end: null });
        setIsSelecting(false);
        setIsDragging(false);
    };

    const getCurrentColumns = () => {
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
        } else if (view === 'Mobility') {
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
    };
    // NEW FEATURE: Excel-like Mass Edit Functions END

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

    // NEW FEATURE: Enhanced columns with individual filters
    const columns = React.useMemo(() => {
        if (view === 'default') {
            return [
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
            ];
        } else if (view === 'DSS') {
            return [
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'Asset Number', accessor: 'asset_number', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'RBC Email', accessor: 'rbc_email', Filter: DefaultColumnFilter },
                { Header: 'Onboarding Date', accessor: 'onboarding_date', Filter: DefaultColumnFilter },
                { Header: 'Assigned Tech', accessor: 'technician', Filter: DefaultColumnFilter },
            ];
        } else if (view === 'HR') {
            return [
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'School', accessor: 'school', Filter: DefaultColumnFilter },
                { Header: 'Business Manager', accessor: 'business_manager', Filter: DefaultColumnFilter },
                { Header: 'Transit', accessor: 'transit', Filter: DefaultColumnFilter },
                { Header: 'Location', accessor: 'location', Filter: DefaultColumnFilter },
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
                { Header: 'IME1', accessor: 'phone_ime1', Filter: DefaultColumnFilter },
                { Header: 'Phone Platform', accessor: 'phone_platform', Filter: DefaultColumnFilter },
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter },
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
            data: isGridEditMode ? gridData : assets,
            defaultColumn: { Filter: DefaultColumnFilter },
        },
        useFilters,
        useSortBy
    );

    return (
        <div className={` mx-auto p-4 ${darkMode ? 'dark' : ''}`}>
            <h1 className="mt-20 text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Central Database</h1>
            
            <div className={`bg-white shadow-lg rounded-lg dark:bg-gray-800 mb-8 p-4 w-full`}>
                <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Actions</h2>
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
                    {/* NEW FEATURE: Excel-like Mass Edit Toggle Button */}
                    <button
                        onClick={toggleGridEditMode}
                        disabled={assets.length === 0}
                        className={`ml-4 px-4 py-2 rounded-md ${
                            assets.length === 0 
                                ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                                : isGridEditMode
                                    ? darkMode 
                                        ? 'bg-red-600 text-gray-100 hover:bg-red-700' 
                                        : 'bg-red-500 text-white hover:bg-red-600'
                                    : darkMode 
                                        ? 'bg-purple-600 text-gray-100 hover:bg-purple-700' 
                                        : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                    >
                        <FontAwesomeIcon icon={faTable} className="mr-2"/>
                        {isGridEditMode ? 'Exit Grid Mode' : 'Mass Edit'}
                    </button>
                    <input
                        id="fileInput"
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                <div className="ml-4">
                    <select
                        value={view}
                        onChange={(e) => setView(e.target.value)}
                        className={`px-4 py-2 rounded-md ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                        disabled={isGridEditMode}
                    >
                        <option value="default">View All</option>
                        <option value="DSS">DSS View</option>
                        <option value="HR">HR View</option>
                        <option value="Mobility">Mobility View</option>
                    </select>
                </div>
                <div className="ml-4 flex items-center gap-2">
                    <select 
                        value={selectedTableName}
                        onChange={handleSelectChange}
                        className={`px-4 py-2 rounded-md ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                        disabled={isGridEditMode}
                    >
                        <option value="">Select Year</option>
                        {tableNames.map((table) => (
                            <option key={table.table_name} value={table.table_name}>
                                {table.table_name}
                            </option>
                        ))}
                    </select>
                    {selectedTableName && !isGridEditMode && (
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

            {/* NEW FEATURE: Excel-like Mass Edit Save/Cancel Bar */}
            {isGridEditMode && (
                <div className="bg-yellow-100 dark:bg-yellow-800 border-l-4 border-yellow-500 p-4 mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-yellow-700 dark:text-yellow-200 font-medium">
                                Excel-like Edit Mode Active
                            </p>
                            <p className="text-yellow-600 dark:text-yellow-300 text-sm">
                                Click+Drag or Shift+Click for ranges • Type to fill selection • Ctrl+V to paste • Delete/Backspace to clear • Arrow keys navigate
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={saveGridChanges}
                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                            >
                                <FontAwesomeIcon icon={faSave} className="mr-2"/>
                                Save All
                            </button>
                            <button
                                onClick={cancelGridChanges}
                                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                            >
                                <FontAwesomeIcon icon={faTimes} className="mr-2"/>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ORIGINAL: Keep original table container structure with horizontal scroll */}
            <div className="w-full overflow-auto shadow-lg rounded-lg">
                <table {...getTableProps()} className="border-collapse bg-white dark:bg-gray-800" style={{width: 'auto', minWidth: '100%'}}>
                    {/* NEW FEATURE: Sticky Table Headers */}
                    <thead className="sticky top-0 z-10">
                        {headerGroups.map(headerGroup => (
                            <tr {...headerGroup.getHeaderGroupProps()}>
                                {headerGroup.headers.map(column => (
                                    <th
                                        {...column.getHeaderProps(column.getSortByToggleProps())}
                                        className="px-6 py-3 border border-gray-300 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                                    >
                                        {/* NEW FEATURE: Enhanced header with sorting and filters */}
                                        <div className="flex items-center justify-between cursor-pointer mb-2">
                                            <span>{column.render('Header')}</span>
                                            <span className="ml-2">
                                                {column.isSorted
                                                    ? column.isSortedDesc
                                                        ? <FontAwesomeIcon icon={faSortDown} className="text-blue-500" />
                                                        : <FontAwesomeIcon icon={faSortUp} className="text-blue-500" />
                                                    : <FontAwesomeIcon icon={faSort} className="text-gray-400" />}
                                            </span>
                                        </div>
                                        {column.canFilter ? column.render('Filter') : null}
                                    </th>
                                ))}
                                {!isGridEditMode && (
                                    <th className="px-6 py-3 border border-gray-300 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        ))}
                    </thead>
                    <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                        {rows.map((row, rowIndex) => {
                            prepareRow(row);
                            return (
                                <tr
                                    {...row.getRowProps()}
                                    className={`${
                                        rowIndex % 2 === 0 
                                            ? 'bg-white dark:bg-gray-800' 
                                            : 'bg-gray-50 dark:bg-gray-750'
                                    } hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors duration-150 ${editAssetId === row.original.id ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
                                >
                                    {row.cells.map(cell => (
                                        <td
                                            {...cell.getCellProps()}
                                            className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-gray-100"
                                        >
                                            {/* NEW FEATURE: Excel-like Grid Cell Rendering */}
                                            {isGridEditMode ? (
                                                <input
                                                    ref={(el) => {
                                                        const key = `${rowIndex}-${cell.column.id}`;
                                                        inputRefs.current[key] = el;
                                                    }}
                                                    type="text"
                                                    value={gridData[rowIndex]?.[cell.column.id] || ''}
                                                    onChange={(e) => handleInput(e, rowIndex, cell.column.id)}
                                                    onClick={(e) => handleCellClick(rowIndex, cell.column.id, e)}
                                                    onMouseDown={(e) => handleMouseDown(rowIndex, cell.column.id, e)}
                                                    onMouseEnter={() => handleMouseEnter(rowIndex, cell.column.id)}
                                                    onMouseUp={handleMouseUp}
                                                    onKeyDown={(e) => handleKeyDown(e, rowIndex, cell.column.id)}
                                                    onPaste={(e) => handlePaste(e, rowIndex, cell.column.id)}
                                                    className={`min-w-full px-6 py-4 border-2 border-dashed border-red-500 bg-transparent focus:outline-none text-sm font-medium resize-none ${
                                                        isCellInRange(rowIndex, cell.column.id)
                                                            ? 'bg-blue-100 dark:bg-blue-900'
                                                            : selectedCell.rowIndex === rowIndex && selectedCell.columnId === cell.column.id
                                                                ? 'ring-2 ring-blue-500'
                                                                : ''
                                                    } ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}
                                                    style={{
                                                        userSelect: isDragging ? 'none' : 'auto',
                                                        width: 'auto',
                                                        minWidth: '100%'
                                                    }}
                                                />
                                            ) : editAssetId === row.original.id ? (
                                                <input
                                                    type="text"
                                                    name={cell.column.id}
                                                    value={editValues[cell.column.id] || ''}
                                                    onChange={handleChange}
                                                    className={`block w-full px-3 py-2 border-2 border-dashed border-red-500 rounded-md shadow-sm focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-900'}`}
                                                />
                                            ) : (
                                                cell.render('Cell')
                                            )}
                                        </td>
                                    ))}
                                    {!isGridEditMode && (
                                        <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-gray-100">
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