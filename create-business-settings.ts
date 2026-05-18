import mysql from 'mysql2/promise'

async function createBusinessSettingsTable() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'viros_gst_new'
  })

  try {
    // Drop existing table if it exists
    await connection.execute('DROP TABLE IF EXISTS business_settings')

    // Create new table
    await connection.execute(`
      CREATE TABLE business_settings (
        id VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        company_name VARCHAR(255) NOT NULL,
        gstin VARCHAR(15) NULL COMMENT 'GST Identification Number',
        pan VARCHAR(10) NULL COMMENT 'Permanent Account Number',
        address TEXT NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        pincode VARCHAR(6) NULL,
        phone VARCHAR(15) NULL,
        email VARCHAR(255) NULL,
        website VARCHAR(500) NULL,
        logo LONGTEXT NULL COMMENT 'Base64 encoded logo image',
        bank_name VARCHAR(100) NULL,
        bank_account VARCHAR(20) NULL,
        bank_ifsc VARCHAR(11) NULL,
        bank_branch VARCHAR(100) NULL,
        invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'VE',
        quotation_prefix VARCHAR(10) NOT NULL DEFAULT 'QT',
        purchase_order_prefix VARCHAR(10) NOT NULL DEFAULT 'PO',
        challan_prefix VARCHAR(10) NOT NULL DEFAULT 'DC',
        terms_condition TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_business_settings (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Insert default data
    const id = crypto.randomUUID()
    await connection.execute(`
      INSERT INTO business_settings (
        id, company_name, gstin, pan, address, city, state, pincode,
        phone, email, website, invoice_prefix, quotation_prefix,
        purchase_order_prefix, challan_prefix, terms_condition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      'Viros Entrepremeurs IT Solutions Pvt.',
      '07BWQPR5953N1ZF',
      'BWQPR5953N',
      '25/2, Block B, Molarband Extension Badarpur, New Delhi, Delhi 110044',
      'New Delhi',
      'Delhi',
      '110044',
      '7290969141',
      'info@virosentrepreneurs.com',
      'https://www.virosentrepreneurs.com/',
      'VE',
      'QT',
      'PO',
      'DC',
      'Warranty as per company guidlines'
    ])

    console.log('✅ Business settings table created and populated successfully!')
    console.log('🏢 Company: Viros Entrepremeurs IT Solutions Pvt.')
    console.log('🆔 GSTIN: 07BWQPR5953N1ZF')
    console.log('🆔 PAN: BWQPR5953N')
    console.log('📞 Phone: 7290969141')
    console.log('📧 Email: info@virosentrepreneurs.com')
    console.log('🌐 Website: https://www.virosentrepreneurs.com/')
    console.log('📍 Address: 25/2, Block B, Molarband Extension Badarpur, New Delhi, Delhi 110044')
    console.log('🏙️ City: New Delhi, State: Delhi, Pincode: 110044')
    console.log('📄 Invoice Prefix: VE, Quotation: QT, PO: PO, Challan: DC')
  } catch (error) {
    console.error('❌ Error creating business settings table:', error)
  } finally {
    await connection.end()
    process.exit(0)
  }
}

createBusinessSettingsTable()