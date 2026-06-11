import db from '@/lib/db'

async function seedBusinessSettings() {
  const settingsData = {
    companyName: 'Viros Entrepremeurs IT Solutions Pvt.',
    gstin: '07BWQPR5953N1ZF',
    pan: 'BWQPR5953N',
    address: '25/2, Block B, Molarband Extension Badarpur, New Delhi, Delhi 110044',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110044',
    phone: '7290969141',
    email: 'info@virosentrepreneurs.com',
    website: 'https://www.virosentrepreneurs.com/',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    bankBranch: '',
    invoicePrefix: 'VE',
    poPrefix: 'PO',
    quotPrefix: 'QT',
    challanPrefix: 'DC',
    termsCondition: 'Warranty as per company guidlines'
  }

  try {
    // Check if settings already exist
    const [existingRows] = await db.execute('SELECT id FROM business_settings LIMIT 1') as any[]

    if (existingRows.length > 0) {
      // Update existing settings
      await db.execute(
        `UPDATE business_settings SET
          company_name=?, gstin=?, pan=?, address=?, city=?, state=?, pincode=?,
          phone=?, email=?, website=?, bank_name=?, bank_account=?, bank_ifsc=?,
          bank_branch=?, invoice_prefix=?, po_prefix=?, quot_prefix=?, challan_prefix=?,
          terms_condition=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [
          settingsData.companyName,
          settingsData.gstin || null,
          settingsData.pan || null,
          settingsData.address || null,
          settingsData.city || null,
          settingsData.state || null,
          settingsData.pincode || null,
          settingsData.phone || null,
          settingsData.email || null,
          settingsData.website || null,
          settingsData.bankName || null,
          settingsData.bankAccount || null,
          settingsData.bankIfsc || null,
          settingsData.bankBranch || null,
          settingsData.invoicePrefix,
          settingsData.poPrefix,
          settingsData.quotPrefix,
          settingsData.challanPrefix,
          settingsData.termsCondition || null,
          existingRows[0].id
        ]
      )
      console.log('Business settings updated successfully')
    } else {
      // Insert new settings
      const id = crypto.randomUUID()
      await db.execute(
        `INSERT INTO business_settings
         (id, company_name, gstin, pan, address, city, state, pincode, phone, email, website,
          bank_name, bank_account, bank_ifsc, bank_branch, invoice_prefix, po_prefix, quot_prefix,
          challan_prefix, terms_condition)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          settingsData.companyName,
          settingsData.gstin || null,
          settingsData.pan || null,
          settingsData.address || null,
          settingsData.city || null,
          settingsData.state || null,
          settingsData.pincode || null,
          settingsData.phone || null,
          settingsData.email || null,
          settingsData.website || null,
          settingsData.bankName || null,
          settingsData.bankAccount || null,
          settingsData.bankIfsc || null,
          settingsData.bankBranch || null,
          settingsData.invoicePrefix,
          settingsData.poPrefix,
          settingsData.quotPrefix,
          settingsData.challanPrefix,
          settingsData.termsCondition || null
        ]
      )
      console.log('Business settings created successfully')
    }
  } catch (error) {
    console.error('Error seeding business settings:', error)
  } finally {
    process.exit(0)
  }
}

seedBusinessSettings()