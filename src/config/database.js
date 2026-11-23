'use strict';

const mysql = require('mysql2/promise');
const { db } = require('./env');

// El pool reutiliza conexiones. Los valores se envían separados del SQL.
const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 50,
  charset: 'utf8mb4',
  dateStrings: true,
  decimalNumbers: true,
  multipleStatements: false,
  connectTimeout: 10000,
  enableKeepAlive: true
});

module.exports = pool;
