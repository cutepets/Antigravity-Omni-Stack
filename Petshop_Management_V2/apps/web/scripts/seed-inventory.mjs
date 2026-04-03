const API_URL = 'http://localhost:3001/api'
const TOKEN = 'FAKE_TOKEN' // Adjust if needed

async function request(method, path, data = null) {
  const url = `${API_URL}${path}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    }
  }
  if (data) options.body = JSON.stringify(data)

  const res = await fetch(url, options)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`Error ${method} ${path}:`, json || res.statusText)
    throw new Error(`Request failed`)
  }
  return json
}

async function seed() {
  console.log('Seeding demo data for inventory...')
  
  // 1. Create Suppliers
  const supplier1 = await request('POST', '/stock/suppliers', {
    name: 'Công ty CP Purina VN',
    phone: '0988111222',
    address: '123 Đường Số 1, Quận 1, TPHCM'
  })
  
  const supplier2 = await request('POST', '/stock/suppliers', {
    name: 'Whiskas Việt Nam',
    phone: '0988333444',
    address: 'KCN VSIP 1, Bình Dương'
  })
  console.log('✅ Created Suppliers')

  // 2. Create sample products
  const productsToCreate = [
    { name: 'Thức ăn hạt Purina Pro Plan 3kg', category: 'Thức ăn', brand: 'Purina', costPrice: 350000, price: 450000, minStock: 5 },
    { name: 'Pate mèo Whiskas cá ngừ hộp 85g', category: 'Thức ăn', brand: 'Whiskas', costPrice: 12000, price: 18000, minStock: 20 },
    { name: 'Sữa tắm SOS cho chó lông trắng', category: 'Vệ sinh', brand: 'SOS', costPrice: 85000, price: 125000, minStock: 10 },
    { name: 'Cát vệ sinh mèo đậu nành 5L', category: 'Vệ sinh', brand: 'Codos', costPrice: 60000, price: 90000, minStock: 15 },
    { name: 'Đồ chơi cần câu mèo gắn chuông', category: 'Đồ chơi', brand: 'NoBrand', costPrice: 15000, price: 35000, minStock: 8 }
  ]

  const createdProducts = []
  for (const p of productsToCreate) {
    const cp = await request('POST', '/inventory/products', p)
    createdProducts.push(cp.data)
  }
  console.log('✅ Created Products')

  // 3. Create a DRAFT receipt
  const receiptDraft = await request('POST', '/stock/receipts', {
    supplierId: supplier1.data.id,
    notes: 'Nhập hàng đợt 1',
    items: [
      { productId: createdProducts[0].id, quantity: 10, unitCost: 350000 },
      { productId: createdProducts[2].id, quantity: 20, unitCost: 85000 }
    ]
  })
  console.log('✅ Created DRAFT Receipt')

  // 4. Create a RECEIVED receipt
  const receiptReceived = await request('POST', '/stock/receipts', {
    supplierId: supplier2.data.id,
    notes: 'Nhập hàng đợt 2 - Whiskas',
    items: [
      { productId: createdProducts[1].id, quantity: 50, unitCost: 12000 },
      { productId: createdProducts[3].id, quantity: 30, unitCost: 60000 }
    ]
  })
  
  // Mark as Received to increase stock
  await request('PATCH', `/stock/receipts/${receiptReceived.data.id}/receive`)
  console.log('✅ Created RECEIVED Receipt')

  console.log('All done! ✨')
}

seed().catch(console.error)
