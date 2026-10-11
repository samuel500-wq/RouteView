import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = await mysql.createConnection({
  host: config.db.host, port: config.db.port,
  user: config.db.user, password: config.db.password,
  multipleStatements: true
});
await root.query(
  `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
);
await root.end();

const conn = await mysql.createConnection({
  host: config.db.host, port: config.db.port,
  user: config.db.user, password: config.db.password,
  database: config.db.database, multipleStatements: true
});
const sql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
await conn.query(sql);
await conn.end();
console.log('[db:init] schema applied.');