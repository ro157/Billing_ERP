import mysql from 'mysql2/promise';

async function addOTPColumns() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL || 'mysql://root:@127.0.0.1:3306/viros_gst_new',
    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+00:00',
  });

  try {
    const connection = await pool.getConnection();
    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS otp VARCHAR(10) NULL,
      ADD COLUMN IF NOT EXISTS otp_expiry DATETIME NULL
    `);
    connection.release();
    console.log('OTP columns added successfully');
  } catch (error) {
    console.error('Error adding OTP columns:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

addOTPColumns();