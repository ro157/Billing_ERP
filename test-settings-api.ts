// Test script to verify the business settings API
async function testBusinessSettingsAPI() {
  const baseURL = 'http://localhost:3001'

  try {
    console.log('🔍 Testing Business Settings API...\n')

    // Test GET request
    console.log('📥 Testing GET /api/settings...')
    const getResponse = await fetch(`${baseURL}/api/settings`)
    const getData = await getResponse.json()

    if (getResponse.ok) {
      console.log('✅ GET request successful!')
      console.log('📊 Retrieved data:')
      console.log(`🏢 Company: ${getData.companyName}`)
      console.log(`🆔 GSTIN: ${getData.gstin}`)
      console.log(`🆔 PAN: ${getData.pan}`)
      console.log(`📞 Phone: ${getData.phone}`)
      console.log(`📧 Email: ${getData.email}`)
      console.log(`🌐 Website: ${getData.website}`)
      console.log(`📍 Address: ${getData.address}`)
      console.log(`🏙️ City: ${getData.city}, State: ${getData.state}, Pincode: ${getData.pincode}`)
      console.log(`📄 Prefixes: INV-${getData.invoicePrefix}, QT-${getData.quotationPrefix}, PO-${getData.purchaseOrderPrefix}, DC-${getData.challanPrefix}`)
      console.log(`📝 Terms: ${getData.termsCondition}`)
    } else {
      console.log('❌ GET request failed:', getData)
    }

    console.log('\n📤 Testing PUT /api/settings...')

    // Test PUT request with updated data
    const updateData = {
      companyName: 'Viros Entrepreneurs IT Solutions Pvt. Ltd.',
      gstin: '07BWQPR5953N1ZF',
      pan: 'BWQPR5953N',
      phone: '7290969141',
      email: 'info@virosentrepreneurs.com',
      website: 'https://www.virosentrepreneurs.com/',
      address: '25/2, Block B, Molarband Extension, Badarpur, New Delhi, Delhi 110044',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110044',
      invoicePrefix: 'VE',
      quotationPrefix: 'QT',
      purchaseOrderPrefix: 'PO',
      challanPrefix: 'DC',
      termsCondition: 'All warranties as per company policy and terms.'
    }

    const putResponse = await fetch(`${baseURL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })

    const putData = await putResponse.json()

    if (putResponse.ok) {
      console.log('✅ PUT request successful!')
      console.log('📝 Updated company name to:', putData.companyName)
      console.log('📝 Updated terms to:', putData.termsCondition)
    } else {
      console.log('❌ PUT request failed:', putData)
    }

    console.log('\n🎉 API testing completed!')

  } catch (error) {
    console.error('❌ Error testing API:', error)
  }
}

testBusinessSettingsAPI()