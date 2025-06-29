import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSave, faTimes, faEdit, faUser, faTrashAlt, faFileExcel, faSync, faUpload,
    faSortUp, faSortDown, faSort // ADDED: Sort icons for column headers
} from '@fortawesome/free-solid-svg-icons';
import { useTable, useFilters, useSortBy } from 'react-table';
import { useTableContext } from './TableContext';
import * as XLSX from 'xlsx';
import axios from 'axios';

// ADDED: Custom filter component for each column
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

    // ADDED: Mass edit functionality state
    const [isMassEditMode, setIsMassEditMode] = useState(false);
    const [massEditData, setMassEditData] = useState({});
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionEnd, setSelectionEnd] = useState(null);
    const [lastSelectedCell, setLastSelectedCell] = useState(null);
    const [saveStatus, setSaveStatus] = useState('');
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

    // ADDED: Mass edit mode functions
    const toggleMassEditMode = () => {
        if (isMassEditMode) {
            // Exit mass edit mode
            setIsMassEditMode(false);
            setMassEditData({});
            setSelectedCells(new Set());
            setSelectionStart(null);
            setSelectionEnd(null);
            setLastSelectedCell(null);
            setSaveStatus('');
        } else {
            // Enter mass edit mode
            setIsMassEditMode(true);
            // Initialize mass edit data with current asset values
            const initialData = {};
            assets.forEach(asset => {
                initialData[asset.id] = { ...asset };
            });
            setMassEditData(initialData);
        }
    };

    // ADDED: Cell selection functions
    const getCellId = (rowId, columnId) => `${rowId}-${columnId}`;

    const handleCellMouseDown = (rowId, columnId, event) => {
        if (!isMassEditMode) return;
        
        event.preventDefault();
        setIsSelecting(true);
        
        const cellId = getCellId(rowId, columnId);
        
        if (event.shiftKey && lastSelectedCell) {
            // Shift+click for range selection
            selectRange(lastSelectedCell, cellId);
        } else {
            // Single cell selection
            setSelectedCells(new Set([cellId]));
            setSelectionStart({ rowId, columnId });
            setSelectionEnd({ rowId, columnId });
            setLastSelectedCell(cellId);
        }
    };

    const handleCellMouseEnter = (rowId, columnId) => {
        if (!isMassEditMode || !isSelecting || !selectionStart) return;
        
        setSelectionEnd({ rowId, columnId });
        updateRangeSelection(selectionStart, { rowId, columnId });
    };

    const handleMouseUp = () => {
        setIsSelecting(false);
    };

    const selectRange = (startCellId, endCellId) => {
        const [startRowId, startColId] = startCellId.split('-');
        const [endRowId, endColId] = endCellId.split('-');
        
        const startRowIndex = assets.findIndex(asset => asset.id.toString() === startRowId);
        const endRowIndex = assets.findIndex(asset => asset.id.toString() === endRowId);
        
        const columns = getEditableColumns();
        const startColIndex = columns.findIndex(col => col.accessor === startColId);
        const endColIndex = columns.findIndex(col => col.accessor === endColId);
        
        const minRow = Math.min(startRowIndex, endRowIndex);
        const maxRow = Math.max(startRowIndex, endRowIndex);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);
        
        const selectedCellIds = new Set();
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (assets[r] && columns[c]) {
                    selectedCellIds.add(getCellId(assets[r].id, columns[c].accessor));
                }
            }
        }
        
        setSelectedCells(selectedCellIds);
    };

    const updateRangeSelection = (start, end) => {
        const startRowIndex = assets.findIndex(asset => asset.id.toString() === start.rowId.toString());
        const endRowIndex = assets.findIndex(asset => asset.id.toString() === end.rowId.toString());
        
        const columns = getEditableColumns();
        const startColIndex = columns.findIndex(col => col.accessor === start.columnId);
        const endColIndex = columns.findIndex(col => col.accessor === end.columnId);
        
        const minRow = Math.min(startRowIndex, endRowIndex);
        const maxRow = Math.max(startRowIndex, endRowIndex);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);
        
        const selectedCellIds = new Set();
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (assets[r] && columns[c]) {
                    selectedCellIds.add(getCellId(assets[r].id, columns[c].accessor));
                }
            }
        }
        
        setSelectedCells(selectedCellIds);
    };

    // ADDED: Get editable columns helper
    const getEditableColumns = () => {
        if (view === 'default') {
            return [
                { accessor: 'employee_id' },
                { accessor: 'business_group' },
                { accessor: 'login_id' },
                { accessor: 'first_name' },
                { accessor: 'preffered_name' },
                { accessor: 'last_name' },
                { accessor: 'rbc_email' },
                { accessor: 'home_drive' },
                { accessor: 'asset_number' },
                { accessor: 'school' },
                { accessor: 'business_manager' },
                { accessor: 'transit' },
                { accessor: 'location' },
                { accessor: 'phone_number' },
                { accessor: 'phone_serial' },
                { accessor: 'phone_ime1' },
                { accessor: 'phone_platform' },
                { accessor: 'onboarding_date' },
                { accessor: 'technician' }
            ];
        } else if (view === 'DSS') {
            return [
                { accessor: 'employee_id' },
                { accessor: 'business_group' },
                { accessor: 'asset_number' },
                { accessor: 'login_id' },
                { accessor: 'first_name' },
                { accessor: 'last_name' },
                { accessor: 'rbc_email' },
                { accessor: 'onboarding_date' },
                { accessor: 'technician' }
            ];
        } else if (view === 'HR') {
            return [
                { accessor: 'business_group' },
                { accessor: 'first_name' },
                { accessor: 'last_name' },
                { accessor: 'school' },
                { accessor: 'business_manager' },
                { accessor: 'transit' },
                { accessor: 'location' },
                { accessor: 'employee_id' },
                { accessor: 'login_id' }
            ];
        } else if (view === 'Mobility') {
            return [
                { accessor: 'first_name' },
                { accessor: 'last_name' },
                { accessor: 'phone_number' },
                { accessor: 'phone_serial' },
                { accessor: 'phone_ime1' },
                { accessor: 'phone_platform' },
                { accessor: 'employee_id' },
                { accessor: 'business_group' },
                { accessor: 'login_id' }
            ];
        }
        return [];
    };

    // ADDED: Handle mass edit cell value change
    const handleMassEditCellChange = (rowId, columnId, value) => {
        if (selectedCells.size > 1) {
            // Update all selected cells
            const newData = { ...massEditData };
            selectedCells.forEach(cellId => {
                const [cellRowId, cellColumnId] = cellId.split('-');
                if (newData[cellRowId]) {
                    newData[cellRowId][cellColumnId] = value;
                }
            });
            setMassEditData(newData);
        } else {
            // Update single cell
            setMassEditData(prev => ({
                ...prev,
                [rowId]: {
                    ...prev[rowId],
                    [columnId]: value
                }
            }));
        }
    };

    // ADDED: Keyboard navigation
    const handleKeyDown = (event, rowId, columnId) => {
        if (!isMassEditMode) return;

        const columns = getEditableColumns();
        const currentRowIndex = assets.findIndex(asset => asset.id.toString() === rowId.toString());
        const currentColIndex = columns.findIndex(col => col.accessor === columnId);

        let newRowIndex = currentRowIndex;
        let newColIndex = currentColIndex;

        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                newRowIndex = Math.min(currentRowIndex + 1, assets.length - 1);
                break;
            case 'Tab':
                event.preventDefault();
                if (event.shiftKey) {
                    newColIndex = Math.max(currentColIndex - 1, 0);
                } else {
                    newColIndex = Math.min(currentColIndex + 1, columns.length - 1);
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                newRowIndex = Math.max(currentRowIndex - 1, 0);
                break;
            case 'ArrowDown':
                event.preventDefault();
                newRowIndex = Math.min(currentRowIndex + 1, assets.length - 1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                newColIndex = Math.max(currentColIndex - 1, 0);
                break;
            case 'ArrowRight':
                event.preventDefault();
                newColIndex = Math.min(currentColIndex + 1, columns.length - 1);
                break;
            case 'Delete':
            case 'Backspace':
                event.preventDefault();
                if (selectedCells.size > 0) {
                    const newData = { ...massEditData };
                    selectedCells.forEach(cellId => {
                        const [cellRowId, cellColumnId] = cellId.split('-');
                        if (newData[cellRowId]) {
                            newData[cellRowId][cellColumnId] = '';
                        }
                    });
                    setMassEditData(newData);
                }
                return;
            default:
                return;
        }

        if (newRowIndex !== currentRowIndex || newColIndex !== currentColIndex) {
            const newRowId = assets[newRowIndex]?.id;
            const newColumnId = columns[newColIndex]?.accessor;
            if (newRowId && newColumnId) {
                const newCellId = getCellId(newRowId, newColumnId);
                setSelectedCells(new Set([newCellId]));
                setLastSelectedCell(newCellId);
                
                // Focus the new cell
                setTimeout(() => {
                    const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
                    if (cellElement) {
                        cellElement.focus();
                    }
                }, 0);
            }
        }
    };

    // ADDED: Handle paste functionality
    const handlePaste = async (event, rowId, columnId) => {
        if (!isMassEditMode) return;
        
        event.preventDefault();
        const clipboardData = event.clipboardData.getData('text');
        const rows = clipboardData.split('\n').filter(row => row.trim() !== '');
        const columns = getEditableColumns();
        
        const startRowIndex = assets.findIndex(asset => asset.id.toString() === rowId.toString());
        const startColIndex = columns.findIndex(col => col.accessor === columnId);
        
        const newData = { ...massEditData };
        
        rows.forEach((row, rowOffset) => {
            const cells = row.split('\t');
            cells.forEach((cellValue, colOffset) => {
                const targetRowIndex = startRowIndex + rowOffset;
                const targetColIndex = startColIndex + colOffset;
                
                if (targetRowIndex < assets.length && targetColIndex < columns.length) {
                    const targetRowId = assets[targetRowIndex].id;
                    const targetColumnId = columns[targetColIndex].accessor;
                    
                    if (newData[targetRowId]) {
                        newData[targetRowId][targetColumnId] = cellValue.trim();
                    }
                }
            });
        });
        
        setMassEditData(newData);
    };

    // ADDED: Save all changes function
    const handleSaveAllChanges = async () => {
        setSaveStatus('Saving...');
        let successCount = 0;
        let errorCount = 0;

        try {
            for (const [assetId, assetData] of Object.entries(massEditData)) {
                try {
                    const response = await fetch(`http://se160590.fg.rbc.com:5000/api/assets/${assetId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(assetData),
                    });
                    
                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`Failed to save asset ${assetId}:`, error);
                }
            }

            if (errorCount === 0) {
                setSaveStatus(`Successfully saved ${successCount} assets!`);
                // Refresh the assets data
                await fetchAssets();
                // Exit mass edit mode
                toggleMassEditMode();
            } else {
                setSaveStatus(`Saved ${successCount} assets, ${errorCount} failed`);
            }
            
            setTimeout(() => setSaveStatus(''), 3000);
            
        } catch (error) {
            setSaveStatus('Error saving changes');
            setTimeout(() => setSaveStatus(''), 3000);
        }
    };

    // ADDED: Add mouse event listeners for mass edit
    useEffect(() => {
        if (isMassEditMode) {
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isMassEditMode]);

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

    // UPDATED: Column definitions with filters and better structure
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
                { Header: 'Assigned Tech', accessor: 'technician', Filter: DefaultColumnFilter }
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
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter }
            );
        } else if (view === 'Mobility') {
            baseColumns.push(
                { Header: 'First Name', accessor: 'first_name', Filter: DefaultColumnFilter },
                { Header: 'Last Name', accessor: 'last_name', Filter: DefaultColumnFilter },
                { Header: 'Phone Number', accessor: 'phone_number', Filter: DefaultColumnFilter },
                { Header: 'Phone Serial', accessor: 'phone_serial', Filter: DefaultColumnFilter },
                { Header: 'IME1', accessor: 'phone_ime1', Filter: DefaultColumnFilter },
                { Header: 'Phone Platform', accessor: 'phone_platform', Filter: DefaultColumnFilter },
                { Header: 'Employee ID', accessor: 'employee_id', Filter: DefaultColumnFilter },
                { Header: 'Business Group', accessor: 'business_group', Filter: DefaultColumnFilter },
                { Header: 'Login ID', accessor: 'login_id', Filter: DefaultColumnFilter }
            );
        }
        
        return baseColumns;
    }, [view]);

    // UPDATED: useTable hook with filters and default column configuration
    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable(
        {
            columns,
            data: assets,
            defaultColumn: { Filter: DefaultColumnFilter }, // ADDED: Default filter for all columns
        },
        useFilters, // ADDED: Enable filtering
        useSortBy
    );

    return (
        <div className={` mx-auto p-4 ${darkMode ? 'dark' : ''}`}>
            <h1 className="mt-20 text-3xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">Central Database</h1>
            
            {/* ADDED: Mass edit mode information bar */}
            {isMassEditMode && (
                <div className="bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Mass Edit Mode Active</h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Click cells to select • Shift+Click for ranges • Ctrl+V to paste • Enter/Tab/Arrows to navigate
                            </p>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSaveAllChanges}
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                            >
                                Save All Changes
                            </button>
                            <button
                                onClick={toggleMassEditMode}
                                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                    {saveStatus && (
                        <div className="mt-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            {saveStatus}
                        </div>
                    )}
                </div>
            )}
            
            <div className={`bg-white shadow-lg rounded-lg dark:bg-gray-800 mb-8 p-4 w-full`}>
                <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 text-center">Actions</h2>
                <div className="flex justify-center">
                    <button
                        onClick={handleFetchAllUserInfo}
                        className={` mr-5 px-4 py-2 rounded-md ${darkMode ? 'bg-green-500 text-gray-100 hover:bg-blue-700' : 'bg-green-500 text-white hover:bg-blue-600'}`}
                        disabled={isMassEditMode} // ADDED: Disable during mass edit
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
                        disabled={isMassEditMode} // ADDED: Disable during mass edit
                    >
                        <FontAwesomeIcon icon={faUpload} className="mr-2"/>
                    </button>
                    {/* ADDED: Mass Edit Button */}
                    <button
                        onClick={toggleMassEditMode}
                        disabled={assets.length === 0}
                        className={`ml-4 px-4 py-2 rounded-md transition-colors ${
                            assets.length === 0 
                                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                : isMassEditMode
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                    >
                        <FontAwesomeIcon icon={faEdit} className="mr-2"/>
                        {isMassEditMode ? 'Exit Grid Mode' : 'Mass Edit'}
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
                                : darkMode 
                                    ? 'bg-gray-800 border-gray-600 text-gray-300' 
                                    : 'bg-white border-gray-300 text-gray-900'
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
                                : darkMode 
                                    ? 'bg-gray-800 border-gray-600 text-gray-300' 
                                    : 'bg-white border-gray-300 text-gray-900'
                        }`}
                    >
                        <option value="">Select Year</option>
                        {tableNames.map((table) => (
                            <option key={table.table_name} value={table.table_name}>
                                {table.table_name}
                            </option>
                        ))}
                    </select>
                    {/* UPDATED: Hide delete button during mass edit */}
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

            {/* UPDATED: Enhanced table with sticky headers, filters, and mass edit support */}
            <div className="w-full overflow-auto shadow-lg rounded-lg">
                <div className="inline-block min-w-full align-middle">
                    <table {...getTableProps()} className="min-w-full border-collapse" ref={tableRef}>
                        {/* UPDATED: Sticky header with filters and sort icons */}
                        <thead className="sticky top-0 z-10">
                            {headerGroups.map(headerGroup => (
                                <React.Fragment key={headerGroup.id}>
                                    <tr {...headerGroup.getHeaderGroupProps()}>
                                        {headerGroup.headers.map(column => (
                                            <th
                                                {...column.getHeaderProps()}
                                                className="px-4 py-3 border border-gray-300 bg-gray-100 dark:bg-gray-700 text-left text-xs font-medium text-gray-700 uppercase tracking-wider dark:text-gray-300"
                                            >
                                                {/* ADDED: Enhanced header with sort icons */}
                                                <div {...column.getSortByToggleProps()} className="flex items-center justify-between cursor-pointer mb-2">
                                                    <span>{column.render('Header')}</span>
                                                    <span className="ml-2">
                                                        {column.isSorted
                                                            ? column.isSortedDesc
                                                                ? <FontAwesomeIcon icon={faSortDown} className="text-blue-500" />
                                                                : <FontAwesomeIcon icon={faSortUp} className="text-blue-500" />
                                                            : <FontAwesomeIcon icon={faSort} className="text-gray-400" />}
                                                    </span>
                                                </div>
                                                {/* ADDED: Column filters */}
                                                {column.canFilter ? column.render('Filter') : null}
                                            </th>
                                        ))}
                                        {/* UPDATED: Hide actions column during mass edit */}
                                        {!isMassEditMode && (
                                            <th className="px-4 py-3 border border-gray-300 bg-gray-100 dark:bg-gray-700 text-left text-xs font-medium text-gray-700 uppercase tracking-wider dark:text-gray-300">
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                </React.Fragment>
                            ))}
                        </thead>
                        {/* UPDATED: Enhanced table body with mass edit support */}
                        <tbody {...getTableBodyProps()} className="bg-white dark:bg-gray-800">
                            {rows.map((row, rowIndex) => {
                                prepareRow(row);
                                return (
                                    <tr
                                        {...row.getRowProps()}
                                        className={`${
                                            rowIndex % 2 === 0 
                                                ? 'bg-white dark:bg-gray-800' 
                                                : 'bg-gray-50 dark:bg-gray-750'
                                        } hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors duration-150 ${
                                            editAssetId === row.original.id ? 'bg-gray-200 dark:bg-gray-600' : ''
                                        }`}
                                    >
                                        {row.cells.map(cell => {
                                            const cellId = getCellId(row.original.id, cell.column.id);
                                            const isSelected = selectedCells.has(cellId);
                                            const cellValue = isMassEditMode && massEditData[row.original.id] 
                                                ? massEditData[row.original.id][cell.column.id] 
                                                : cell.value;

                                            return (
                                                <td
                                                    {...cell.getCellProps()}
                                                    className={`px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-100 ${
                                                        isSelected ? 'ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900' : ''
                                                    }`}
                                                    onMouseDown={(e) => handleCellMouseDown(row.original.id, cell.column.id, e)}
                                                    onMouseEnter={() => handleCellMouseEnter(row.original.id, cell.column.id)}
                                                >
                                                    {isMassEditMode ? (
                                                        /* ADDED: Mass edit input fields */
                                                        <input
                                                            type="text"
                                                            value={cellValue || ''}
                                                            onChange={(e) => handleMassEditCellChange(row.original.id, cell.column.id, e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(e, row.original.id, cell.column.id)}
                                                            onPaste={(e) => handlePaste(e, row.original.id, cell.column.id)}
                                                            data-cell-id={cellId}
                                                            className={`w-full px-2 py-1 border-none outline-none bg-transparent ${
                                                                isSelected ? 'ring-1 ring-blue-400' : ''
                                                            }`}
                                                        />
                                                    ) : editAssetId === row.original.id ? (
                                                        /* Existing single-row edit functionality */
                                                        <input
                                                            type="text"
                                                            name={cell.column.id}
                                                            value={editValues[cell.column.id] || ''}
                                                            onChange={handleChange}
                                                            className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                                                darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'border-gray-300 bg-white text-gray-900'
                                                            }`}
                                                        />
                                                    ) : (
                                                        /* Normal cell display */
                                                        <div className="truncate" title={cell.value}>
                                                            {cell.render('Cell')}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {/* UPDATED: Actions column (hidden during mass edit) */}
                                        {!isMassEditMode && (
                                            <td className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-100">
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