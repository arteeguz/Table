
const { Pool } = require('pg');
require('dotenv').config()

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});



const createTableQuery = 
    ` CREATE TABLE IF NOT EXISTS asset_table (
        id SERIAL PROMARY KEY,
        asset VARCHAR(100) NOT NULL,
        tech VARCHAR(100) NOT NULL
    );
`;

const createTable = async () => {
    try{
        await pool.query(createTalbeQuery);
        console.log('Table Created');
    }catch (err){
        console.error('Error executing query', err.stack);
    }
};

/*

CREATE TABLE batches (
    id SERIAL PRIMARY KEY,
    batch_date DATE,
    technician VARCHAR(255)
);

CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    batch_date DATE,
    asset_number VARCHAR(100),
    technician VARCHAR(255),
    imaging_complete BOOLEAN DEFAULT FALSE,
    ynx1c_complete BOOLEAN DEFAULT FALSE,
    business_bundles_complete BOOLEAN DEFAULT FALSE,
    rsa_complete BOOLEAN DEFAULT FALSE,
    login_id VARCHAR(255),
    business_group VARCHAR(255),
    employee_id VARCHAR(255),
    rbc_email VARCHAR(255),
    home_drive VARCHAR(255),
    first_name VARCHAR(255),
    preffered_name VARCHAR(255),
    last_name VARCHAR(255),
    transit VARCHAR(255),
    business_manager VARCHAR(255),
    location VARCHAR(255),
    phone_number VARCHAR(255),
    phone_serial VARCHAR(255),
    phone_ime1 VARCHAR(255),
    phone_platform VARCHAR(255),
    onboarding_date VARCHAT(255),
    school VARCHAT(255),
    table_name VARCHAT(255),
    ynx1c_date VARCHAT(255),
    imaging_VARCHAT(255),
);


CREATE TABLE supplies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL
);

CREATE TABLE defective_devices (
    id SERIAL PRIMARY KEY,
    asset_tag VARCHAR(50) NOT NULL,
    reason VARCHAR(100) NOT NULL
);

CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    method VARCHAR(10),
    url TEXT
);

CREATE TABLE technicians(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE scripts(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    script VARCHAR(2000)
);

*/

createTable();


module.exports = {
    query: (text,params, callback) => {
        console.log("QUERY:", text,params || "");
        return pool.query(text,params,callback);
    },
};