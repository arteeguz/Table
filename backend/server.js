// server/index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const { exec } = require('child_process');
const { logRequest } = require('./logger');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { p } = require('node-ptouch/lib/charset-brother');
var ps = require('ps');
pg.defaults.ssl=true;
const https = require('https');


const app = express();
const port = process.env.PORT || 5000;


process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';


const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

/*

const conString = 'postgres://pugz0srvpsppuwm00dbo:i3o_lw7MAVjzv9E8strplvbugz00b0-1.fg.rbc.com:34532/onboardingdashboard?sslmode=require';

const pool = new Pool({
  connectionString: conString,
  ssl:{
    rejectUnauthorized: false
  }
});
*/


app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(logRequest);

app.get('/', (req, res) => {
  res.send('Welcome to the RBC Asset Management API');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const filePath = path.join(__dirname, 'uploads', req.file.filename);
  console.log('Uploaded file path:', filePath); // Debug statement

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    console.log('Parsed JSON data:', jsonData); // Debug statement

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let row of jsonData) {
        const { AssetNumber, LoginID, BusinessGroup, EmployeeID, FirstName, PrefferedName, LastName, RBCEmail, HomeDrive, Transit, BusinessManager, School, Location, PhoneNumber, PhoneSerial, IME1, Platform, OnboardingDate, Technician, BatchDate, TableName
        } = row;

        console.log('Processing row:', { AssetNumber, LoginID, BusinessGroup, EmployeeID }); // Debug statement

        if (AssetNumber && LoginID && BusinessGroup && EmployeeID) {
          await client.query(
            'INSERT INTO assets (asset_number, login_id, business_group, employee_id, first_name, preffered_name, last_name, rbc_email, home_drive, transit, business_manager, school, location, phone_number, phone_serial, phone_ime1, phone_latform, onboarding_date, technician, batch_date, table_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)',
            [AssetNumber, LoginID, BusinessGroup, EmployeeID, FirstName, PrefferedName, LastName, RBCEmail, HomeDrive, Transit, BusinessManager, School, Location, PhoneNumber, PhoneSerial, IME1, Platform, OnboardingDate, Technician, BatchDate, TableName
            ]
          );
        }
      }

      await client.query('COMMIT');
      res.send('File uploaded and data inserted successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error inserting data into database:', error);
      res.status(500).send('Error inserting data into database');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Server error');
  } finally {
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error removing file:', err);
    });
  }
});

app.get('/api/asset-by-table', async (req,res) => {
  const {table_name} = req.query;
  
  try{
    const query = `
      SELECT *
      FROM assets
      WHERE table_name = $1;
    `;
    const values = [table_name];
    
    const result = await pool.query(query, values);
    res.json(result.rows);
  }catch (error){
    console.log('Error fetching by year', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/table-names', async (req,res) => {
  try{
    const result = await pool.query('SELECT DISTINCT table_name FROM assets');
    res.json(result.rows);
  }catch(error){
    console.log('Error fetching table names:', error);
    res.status(500).json({error: 'Failed to fetch table names'});
  }
});

// Delete table endpoint
app.delete('/api/tables/:tableName', async (req, res) => {
  const { tableName } = req.params;
  
  if (!tableName) {
    return res.status(400).send({ success: false, error: 'Table name is required' });
  }
  
  try {
    const result = await pool.query('DELETE FROM assets WHERE table_name = $1', [tableName]);
    res.send({ 
      success: true, 
      message: `Deleted ${result.rowCount} assets from table "${tableName}"` 
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

app.post('/api/print-test', async (req, res) => {
  try {
    const ptouch = new PTouchPrint();
    
    // Connect to the printer (replace 'your-printer-ip' with the actual IP)
    await ptouch.connect('10.9.96.12', 9100); // Port 9100 is usually the default for Brother printers
    
    // Print a basic label
    await ptouch.printText('Test Page\nThis is a test print from Node.js!');
    
    // Close the connection after printing
    ptouch.close();
    
    res.status(200).send('Test page printed successfully');
  } catch (error) {
    console.error('Error printing test page:', error);
    res.status(500).send('Failed to print test page');
  }
});

app.post('/api/print-label', async (req, res) => {
  try {
    const { firstName, lastName, qrValue } = req.body;
    const printer = new BrotherLabelPrinter('10.9.96.12');
    
    await printer.print({
      text: `${firstName} ${lastName}`,
      qrCode: qrValue,
      options: {
        qrSize: 128,
      }
    });
    
    res.status(200).send('Label printed successfully');
  } catch (error) {
    console.error('Error printing label:', error);
    res.status(500).send('Failed to print label');
  }
});


app.post('/api/get-asset-info', (req, res) => {
  const { hostname } = req.body;
  
  if (!hostname) {
    return res.status(400).send({ success: false, error: 'Hostname is required' });
  }
  
  const script = `$hostname = "${hostname}"; $computerSystem = Get-CimInstance -ClassName Win32_ComputerSystem -ComputerName $hostname; $bios = Get-CimInstance -ClassName Win32_BIOS -ComputerName $hostname; $os = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $hostname; $processor = Get-CimInstance -ClassName Win32_Processor -ComputerName $hostname | Select-Object -First 1; $memory = Get-CimInstance -ClassName Win32_PhysicalMemory -ComputerName $hostname | Measure-Object -Property Capacity -Sum; $disk = Get-CimInstance -ClassName Win32_LogicalDisk -ComputerName $hostname -Filter "DriveType=3" | Select-Object DeviceID, Size, FreeSpace; @{ComputerName=$computerSystem.Name; Domain=$computerSystem.Domain; Manufacturer=$computerSystem.Manufacturer; Model=$computerSystem.Model; SerialNumber=$bios.SerialNumber; OSName=$os.Caption; OSVersion=$os.Version; OSArchitecture=$os.OSArchitecture; Processor=$processor.Name; TotalMemoryGB=[math]::Round($memory.Sum / 1GB, 2); DiskInfo=$disk} | ConvertTo-Json`;
  
  exec(`powershell -Command "${script}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error}`);
      return res.status(500).send({ success: false, error: stderr });
    }
    
    try {
      const output = JSON.parse(stdout);
      res.send({ success: true, ...output });
    } catch (parseError) {
      console.error('Error parsing JSON response: ${parseError}');
      res.status(500).send({ success: false, error: 'Invalid JSON response from PowerShell script' });
    }
  });
});



// === Assets Inventory Endpoints ===

// Endpoint to get all assets
app.get('/api/assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assets ORDER BY id');
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to add a batch of assets
app.post('/api/assets', async (req, res) => {
  const { batchDate, technician, assets } = req.body;
  const client = await pool.connect();
  
  try {
    if (!batchDate || !technician || !assets || !Array.isArray(assets)) {
      return res.status(400).send({ success: false, error: 'Invalid request body' });
    }
    
    await client.query('BEGIN');
    const promises = assets.map((asset) =>
      client.query(
        'INSERT INTO assets (batch_date, technician, asset_number, login_id, business_group, employee_id, rbc_email, home_drive, home_directory, remote_access) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [batchDate, technician, asset.asset_number, asset.login_id, asset.business_group, asset.employee_id, asset.rbc_email, asset.home_drive, asset.home_directory, asset.remote_access]
      )
    );
    const results = await Promise.all(promises);
    await client.query('COMMIT');
    res.send(results.map(result => result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting assets:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  } finally {
    client.release();
  }
});


// Endpoint to delete an asset
app.delete('/api/assets/:id', async (req, res) => {
  const assetId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [assetId]);
    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Asset not found' });
    }
    res.send({ success: true });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to edit an asset
app.put('/api/assets/:id', async (req, res) => {
  const assetId = req.params.id;
  const { asset_number, login_id, business_group, employee_id, rbc_email, home_drive, first_name, last_name } = req.body;
  
  if (!asset_number) {
    return res.status(400).send({ success: false, error: 'Asset number is required' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE assets SET asset_number = $1, login_id = $2, business_group = $3, employee_id = $4, rbc_email = $5, home_drive = $6, first_name = $7, last_name = $8 WHERE id = $9 RETURNING *',
      [asset_number, login_id, business_group, employee_id, rbc_email, home_drive, first_name, last_name, assetId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Asset not found' });
    }
    
    res.send(result.rows[0]);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});


// === Supplies Inventory Endpoints ===

// Endpoint to get all supplies
app.get('/api/supplies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM supplies ORDER BY id');
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching supplies:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to add a supply
app.post('/api/supplies', async (req, res) => {
  const { name, quantity } = req.body;
  
  console.log('Request body:', req.body); // Log the request body
  
  if (!name || !quantity) {
    return res.status(400).send({ success: false, error: 'Both name and quantity are required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO supplies (name, quantity) VALUES ($1, $2) RETURNING *',
      [name, quantity]
    );
    res.send(result.rows[0]);
  } catch (error) {
    console.error('Error adding supply:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to delete a supply
app.delete('/api/supplies/:id', async (req, res) => {
  const supplyId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM supplies WHERE id = $1 RETURNING *', [supplyId]);
    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Supply not found' });
    }
    res.send({ success: true });
  } catch (error) {
    console.error('Error deleting supply:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to update a supply
app.put('/api/supplies/:id', async (req, res) => {
  const supplyId = req.params.id;
  const { quantity } = req.body;
  
  if (!quantity) {
    return res.status(400).send({ success: false, error: 'Quantity is required' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE supplies SET quantity = $1 WHERE id = $2 RETURNING *',
      [quantity, supplyId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Supply not found' });
    }
    
    res.send(result.rows[0]);
  } catch (error) {
    console.error('Error updating supply:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});



// === Defective Devices Endpoints ===

// Endpoint to get all defective devices
app.get('/api/defective-devices', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM defective_devices ORDER BY id');
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching defective devices:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to add a defective device
app.post('/api/defective-devices', async (req, res) => {
  const { asset_tag, reason } = req.body;
  
  if (!asset_tag || !reason) {
    return res.status(400).send({ success: false, error: 'Both asset tag and reason are required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO defective_devices (asset_tag, reason) VALUES ($1, $2) RETURNING *',
      [asset_tag, reason]
    );
    res.send(result.rows[0]);
  } catch (error) {
    console.error('Error adding defective device:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to delete a defective device
app.delete('/api/defective-devices/:id', async (req, res) => {
  const deviceId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM defective_devices WHERE id = $1 RETURNING *', [deviceId]);
    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Defective device not found' });
    }
    res.send({ success: true });
  } catch (error) {
    console.error('Error deleting defective device:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});


// === Dashboard Statististics Endpoints ===

app.get('/api/statistics', async (req, res) => {
  try {
    // Total Assets
    const totalAssetsResult = await pool.query('SELECT COUNT(*) FROM assets');
    const totalAssets = parseInt(totalAssetsResult.rows[0].count, 10);
    
    // Defective Devices
    const defectiveDevicesResult = await pool.query('SELECT COUNT(*) FROM defective_devices');
    const defectiveDevices = parseInt(defectiveDevicesResult.rows[0].count, 10);
    
    // Assets Ready and Not Ready
    const assetsReadyResult = await pool.query(`
      SELECT COUNT(*) FROM assets
      WHERE imaging_complete = TRUE
        AND ynx1c_complete = TRUE
        AND business_bundles_complete = TRUE
        AND rsa_complete = TRUE
    `);
    const assetsReady = parseInt(assetsReadyResult.rows[0].count, 10);
    
    const assetsNotReadyResult = await pool.query(`
      SELECT COUNT(*) FROM assets
      WHERE NOT (
        imaging_complete = TRUE
        AND ynx1c_complete = TRUE
        AND business_bundles_complete = TRUE
        AND rsa_complete = TRUE
      )
    `);
    const assetsNotReady = parseInt(assetsNotReadyResult.rows[0].count, 10);
    
    // Imaging, YNX1C, Bundles, RSA Counts
    const imagingCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE imaging_complete = TRUE');
    const imagingComplete = parseInt(imagingCompleteResult.rows[0].count, 10);
    
    const ynx1cCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE ynx1c_complete = TRUE');
    const ynx1cComplete = parseInt(ynx1cCompleteResult.rows[0].count, 10);
    
    const bundlesCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE business_bundles_complete = TRUE');
    const bundlesComplete = parseInt(bundlesCompleteResult.rows[0].count, 10);
    
    const rsaCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE rsa_complete = TRUE');
    const rsaComplete = parseInt(rsaCompleteResult.rows[0].count, 10);
    
    // Assets by Technician
    const assetsByTechnicianResult = await pool.query('SELECT technician, COUNT(*) FROM assets GROUP BY technician');
    const assetsByTechnician = assetsByTechnicianResult.rows.map(row => ({
      technician: row.technician,
      count: parseInt(row.count, 10),
    }));
    
    res.json({
      total_assets: totalAssets,
      defective_devices: defectiveDevices,
      assets_ready: assetsReady,
      assets_not_ready: assetsNotReady,
      imaging_complete: imagingComplete,
      ynx1c_complete: ynx1cComplete,
      bundles_complete: bundlesComplete,
      rsa_complete: rsaComplete,
      assets_by_technician: assetsByTechnician,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/statistics-table', async (req, res) => {
  const {table_name} = req.query;
  
  try {
    // Total Assets
    const totalAssetsResult = await pool.query('SELECT COUNT(*) FROM assets WHERE table_name = $1',[table_name]);
    const totalAssets = parseInt(totalAssetsResult.rows[0].count, 10);
    
    // Defective Devices
    const defectiveDevicesResult = await pool.query('SELECT COUNT(*) FROM defective_devices');
    const defectiveDevices = parseInt(defectiveDevicesResult.rows[0].count, 10);
    
    // Assets Ready and Not Ready
    const assetsReadyResult = await pool.query(`
      SELECT COUNT(*) FROM assets
      WHERE imaging_complete = TRUE
        AND ynx1c_complete = TRUE
        AND business_bundles_complete = TRUE
        AND rsa_complete = TRUE
        AND table_name = $1
    `,[table_name]);

const assetsReady = parseInt(assetsReadyResult.rows[0].count, 10);

const assetsNotReadyResult = await pool.query(`
  SELECT COUNT(*) FROM assets
  WHERE table_name = $1
  AND NOT (
    imaging_complete = TRUE
    AND ynx1c_complete = TRUE
    AND business_bundles_complete = TRUE
    AND rsa_complete = TRUE
  )
`,[table_name]);

const assetsNotReady = parseInt(assetsNotReadyResult.rows[0].count, 10);

// Imaging, YNX1C, Bundles, RSA Counts
const imagingCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE imaging_complete = TRUE AND table_name = $1',[table_name]);
const imagingComplete = parseInt(imagingCompleteResult.rows[0].count, 10);

const ynx1cCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE ynx1c_complete = TRUE AND table_name = $1',[table_name]);
const ynx1cComplete = parseInt(ynx1cCompleteResult.rows[0].count, 10);

const bundlesCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE business_bundles_complete = TRUE AND table_name = $1',[table_name]);
const bundlesComplete = parseInt(bundlesCompleteResult.rows[0].count, 10);

const rsaCompleteResult = await pool.query('SELECT COUNT(*) FROM assets WHERE rsa_complete = TRUE AND table_name = $1',[table_name]);
const rsaComplete = parseInt(rsaCompleteResult.rows[0].count, 10);

// Assets by Technician
const assetsByTechnicianResult = await pool.query('SELECT technician, COUNT(*) FROM assets WHERE table_name = $1 GROUP BY technician',[table_name]);
const assetsByTechnician = assetsByTechnicianResult.rows.map(row => ({
  technician: row.technician,
  count: parseInt(row.count, 10),
}));

res.json({
  total_assets: totalAssets,
  defective_devices: defectiveDevices,
  assets_ready: assetsReady,
  assets_not_ready: assetsNotReady,
  imaging_complete: imagingComplete,
  ynx1c_complete: ynx1cComplete,
  bundles_complete: bundlesComplete,
  rsa_complete: rsaComplete,
  assets_by_technician: assetsByTechnician,
});
} catch (error) {
  console.error('Error fetching statistics:', error);
  res.status(500).json({ success: false, error: error.message });
}
});


// === PowerShell Scripts Endpoints ===

app.post('/api/run-powershell', (req, res) => {
  const script = req.body.script;
  
  if (!script) {
    return res.status(400).send({ success: false, error: 'PowerShell script is required' });
  }
  
  exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error}`);
      return res.status(500).send({ success: false, error: stderr });
    }
    res.send({ success: true, output: stdout });
  });
});

// Fetch all saved scripts
app.get('/api/scripts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scripts ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// Add a new script
app.post('/api/scripts', async (req, res) => {
  const { name, script } = req.body;
  try {
    const result = await pool.query('INSERT INTO scripts (name, script) VALUES ($1, $2) RETURNING *', [name, script]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding script:', error);
    res.status(500).json({ error: 'Failed to add script' });
  }
});

// Update an existing script
app.put('/api/scripts', async (req, res) => {
  const { id, name, script } = req.body;
  try {
    const result = await pool.query('UPDATE scripts SET name=$1, script=$2 WHERE id=$3 RETURNING *', [name, script, id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

// Delete a script
app.delete('/api/scripts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM scripts WHERE id=$1', [id]);
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});




// === Technicians Endpoints ===

// Endpoint to get all technicians
app.get('/api/technicians', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM technicians ORDER BY id');
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to add a technician
app.post('/api/technicians', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).send({ success: false, error: 'Technician name is required' });
  }
  
  try {
    const result = await pool.query('INSERT INTO technicians (name) VALUES ($1) RETURNING *', [name]);
    res.send(result.rows[0]);
  } catch (error) {
    console.error('Error adding technician:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to update a technician
app.put('/api/technicians/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).send({ success: false, error: 'Technician name is required' });
  }
  
  try {
    const result = await pool.query('UPDATE technicians SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Technician not found' });
    }
    res.send(result.rows[0]);
  } catch (error) {
    console.error('Error updating technician:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Endpoint to delete a technician
app.delete('/api/technicians/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM technicians WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Technician not found' });
    }
    res.send({ success: true });
  } catch (error) {
    console.error('Error deleting technician:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Update an asset's stage status
app.put('/api/assets/:id/stage', (req, res) => {
  const { id } = req.params;
  const { stage, status } = req.body;
  const validStages = ['imaging_complete', 'ynx1c_complete', 'business_bundles_complete', 'rsa_complete', 'bundle_check'];
  
  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage' });
  }
  
  pool.query(`UPDATE assets SET ${stage} = $1 WHERE id = $2 RETURNING *`, [status, id], (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows[0]);
  });
});

// Update all assets in a batch to a specific stage status
app.put('/api/batch/:batch_date/:technician/stage', (req, res) => {
  const { batch_date, technician } = req.params;
  const { stage, status } = req.body;
  const validStages = ['imaging_complete', 'ynx1c_complete', 'business_bundles_complete', 'rsa_complete', 'bundle_check'];
  
  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage' });
  }
  
  pool.query(
    `UPDATE assets SET ${stage} = $1 WHERE batch_date = $2 AND technician = $3 RETURNING *`,
    [status, batch_date, technician],
    (error, results) => {
      if (error) {
        throw error;
      }
      res.status(200).json(results.rows);
    }
  );
});

app.put('/api/assets/:id/ynx1cdate', (req, res) => {
  const assetId = req.params.id;
  const { ynx1cDate, status } = req.body;
  
  pool.query(`UPDATE assets SET ynx1c_date = $1, ynx1c_complete = $2 WHERE id = $3 RETURNING *`, [ynx1cDate, status, assetId], (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows[0]);
  });
});

app.put('/api/assets/:id/imagingdate', (req, res) => {
  const assetId = req.params.id;
  const { imagingDate, status } = req.body;
  
  pool.query(`UPDATE assets SET imaging_date = $1, imaging_complete = $2 WHERE id = $3 RETURNING *`, [imagingDate, status, assetId], (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows[0]);
  });
});

app.post('/api/run-rsacheck', (req, res) => {
  const script = req.body.script;
  
  if (!script) {
    return res.status(400).send({ success: false, error: 'PowerShell script is required' });
  }
  
  exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/\\\\/g, '\\')}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error}`);
      return res.status(500).send({ success: false, error: stderr });
    }
    res.send({ success: true, output: stdout });
  });
});

app.put('/api/assets/:id/rsadone', (req, res) => {
  const assetId = req.params.id;
  const { status } = req.body;
  
  pool.query(`UPDATE assets SET rsa_complete = $1 WHERE id = $2 RETURNING *`, [ status, assetId], (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows[0]);
  });
});

app.put('/api/assets/:id/tsbundle', (req, res) => {
  const assetId = req.params.id;
  const { status } = req.body;
  
  pool.query(`UPDATE assets SET business_bundles_complete = $1 WHERE id = $2 RETURNING *`, [ status, assetId], (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows[0]);
  });
});

app.put('/api/assets/:id/bscbundle', (req, res) => {
  const assetId = req.params.id;
  const { status } = req.body;
  
  pool.query(`UPDATE assets SET bundle_check = $1 WHERE id = $2 RETURNING *`, [ status, assetId], (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows[0]);
  });
});



/*

app.put('/api/assets/:id', async (req, res) => {
  const assetId = req.params.id;
  const { asset_number, login_id, business_group, employee_id, rbc_email, home_drive, first_name, last_name } = req.body;
  
  if (!asset_number) {
    return res.status(400).send({ success: false, error: 'Asset number is required' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE assets SET asset_number = $1, login_id = $2, business_group = $3, employee_id = $4, rbc_email = $5, home_drive = $6, first_name = $7, last_name = $8 WHERE id = $9 RETURNING *',
      [asset_number, login_id, business_group, employee_id, rbc_email, home_drive, first_name, last_name, assetId]
    );

    if (result.rowCount === 0) {
      return res.status(404).send({ success: false, error: 'Asset not found' });
    }
    
    res.send(result.rows[0]);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

*/
