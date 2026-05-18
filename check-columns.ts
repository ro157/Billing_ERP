import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkColumns() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL || 'mysql://root:@127.0.0.1:3306/viros_gst_new',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.execute('DESCRIBE users');
    connection.release();
    console.log('Database columns:');
    console.log(result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkColumns();
