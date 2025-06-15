const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function logRequest(req, res, next) {
    const client = await pool.connect();
    const { method, url } = req;

    try {
        await client.query('INSERT INTO logs (method, url) VALUES ($1, $2)', [method, url]);
        next();
    } catch (error) {
        console.error('Error logging request:', error);
        res.status(500).send('Error logging request');
    } finally {
        client.release();
    }
}

module.exports = { logRequest };