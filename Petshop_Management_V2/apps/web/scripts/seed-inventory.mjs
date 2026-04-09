const API_URL = 'http://localhost:3001/api'
const TOKEN = 'FAKE_TOKEN' // Replace if your API requires a real token.

async function request(method, path, data = null) {
  const url = `${API_URL}${path}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  }

  if (data) options.body = JSON.stringify(data)

  const response = await fetch(url, options)
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    console.error(`Error ${method} ${path}:`, json || response.statusText)
    throw new Error(`Request failed for ${method} ${path}`)
  }
  return json
}

async function createProduct(product) {
  const response = await request('POST', '/inventory/products', product)
  return response.data
}

async function seed() {
  console.log('Seeding procurement demo data for inventory...')

  const suppliers = await Promise.all([
    request('POST', '/stock/suppliers', {
      name: 'Royal Demo Supplier',
      phone: '0988111222',
      email: 'royal.demo@petcare.local',
      address: '123 Duong so 1, Quan 1, TP HCM',
      monthTarget: 18000000,
      yearTarget: 210000000,
      notes: 'Demo NCC chinh cho script seed API',
    }),
    request('POST', '/stock/suppliers', {
      name: 'Accessory Demo Supplier',
      phone: '0988333444',
      email: 'accessory.demo@petcare.local',
      address: 'KCN VSIP 1, Binh Duong',
      monthTarget: 12000000,
      yearTarget: 145000000,
      notes: 'Demo NCC phu kien va hang doi tra',
    }),
  ])
  console.log('Created suppliers')

  const [dogFood, shampoo, cage, catFood] = await Promise.all([
    createProduct({ name: 'Thuc an demo Royal Adult 3kg', category: 'Thuc an', brand: 'Royal Demo', costPrice: 350000, price: 450000, minStock: 5, unit: 'goi' }),
    createProduct({ name: 'Sua tam demo long trang 500ml', category: 'Ve sinh', brand: 'Bio Demo', costPrice: 85000, price: 125000, minStock: 10, unit: 'chai' }),
    createProduct({ name: 'Long van chuyen demo size M', category: 'Phu kien', brand: 'PetStyle Demo', costPrice: 305000, price: 420000, minStock: 4, unit: 'cai' }),
    createProduct({ name: 'Pate demo Tuna 80g', category: 'Thuc an', brand: 'Me O Demo', costPrice: 12000, price: 18000, minStock: 24, unit: 'hop' }),
  ])
  console.log('Created demo products')

  const draftReceipt = await request('POST', '/stock/receipts', {
    supplierId: suppliers[0].data.id,
    notes: 'Demo don nhap dang tao, da tam ung',
    items: [
      { productId: dogFood.id, quantity: 8, unitCost: 350000 },
      { productId: shampoo.id, quantity: 12, unitCost: 85000 },
    ],
  })
  await request('POST', `/stock/suppliers/${suppliers[0].data.id}/payments`, {
    amount: 1200000,
    paymentMethod: 'BANK',
    notes: `Tam ung truoc cho ${draftReceipt.data.receiptNumber}`,
  })
  console.log('Created draft receipt with supplier prepayment')

  const partialReceipt = await request('POST', '/stock/receipts', {
    supplierId: suppliers[1].data.id,
    notes: 'Demo phieu nhap nhap mot phan',
    items: [
      { productId: cage.id, quantity: 6, unitCost: 305000 },
      { productId: catFood.id, quantity: 40, unitCost: 12000 },
    ],
  })
  await request('POST', `/stock/receipts/${partialReceipt.data.id}/receivings`, {
    notes: 'Nhan dot 1',
    items: [
      { receiptItemId: partialReceipt.data.items[0].id, quantity: 3 },
      { receiptItemId: partialReceipt.data.items[1].id, quantity: 24 },
    ],
  })
  await request('POST', `/stock/receipts/${partialReceipt.data.id}/payments`, {
    amount: 900000,
    paymentMethod: 'BANK',
    notes: 'Thanh toan mot phan sau dot nhap 1',
  })
  console.log('Created partial received receipt')

  const fullReceipt = await request('POST', '/stock/receipts', {
    supplierId: suppliers[0].data.id,
    notes: 'Demo phieu nhap da nhap du va thanh toan nhieu dot',
    items: [
      { productId: dogFood.id, quantity: 10, unitCost: 350000 },
      { productId: shampoo.id, quantity: 18, unitCost: 85000 },
    ],
  })
  await request('POST', `/stock/receipts/${fullReceipt.data.id}/receivings`, {
    notes: 'Nhan dot 1',
    items: [
      { receiptItemId: fullReceipt.data.items[0].id, quantity: 4 },
      { receiptItemId: fullReceipt.data.items[1].id, quantity: 8 },
    ],
  })
  await request('POST', `/stock/receipts/${fullReceipt.data.id}/payments`, {
    amount: 1800000,
    paymentMethod: 'BANK',
    notes: 'Thanh toan dot 1',
  })
  await request('POST', `/stock/receipts/${fullReceipt.data.id}/receivings`, {
    notes: 'Nhan dot 2',
    items: [
      { receiptItemId: fullReceipt.data.items[0].id, quantity: 6 },
      { receiptItemId: fullReceipt.data.items[1].id, quantity: 10 },
    ],
  })
  await request('POST', `/stock/receipts/${fullReceipt.data.id}/payments`, {
    amount: 3230000,
    paymentMethod: 'CASH',
    notes: 'Thanh toan dot 2',
  })
  console.log('Created fully received receipt with multiple payments')

  const shortClosedReceipt = await request('POST', '/stock/receipts', {
    supplierId: suppliers[1].data.id,
    notes: 'Demo phieu nhap chot thieu',
    items: [
      { productId: cage.id, quantity: 5, unitCost: 305000 },
      { productId: catFood.id, quantity: 36, unitCost: 12000 },
    ],
  })
  await request('POST', `/stock/receipts/${shortClosedReceipt.data.id}/receivings`, {
    notes: 'Nhan hang thieu',
    items: [
      { receiptItemId: shortClosedReceipt.data.items[0].id, quantity: 4 },
      { receiptItemId: shortClosedReceipt.data.items[1].id, quantity: 20 },
    ],
  })
  await request('POST', `/stock/receipts/${shortClosedReceipt.data.id}/close`, {
    notes: 'NCC giao thieu, chap nhan chot',
    items: [
      { receiptItemId: shortClosedReceipt.data.items[0].id, quantity: 1 },
      { receiptItemId: shortClosedReceipt.data.items[1].id, quantity: 16 },
    ],
  })
  await request('POST', `/stock/receipts/${shortClosedReceipt.data.id}/payments`, {
    amount: 1658000,
    paymentMethod: 'BANK',
    notes: 'Thanh toan sau doi chieu chot thieu',
  })
  console.log('Created short-closed receipt')

  const supplierReturn = await request('POST', `/stock/receipts/${fullReceipt.data.id}/returns`, {
    notes: 'Tra NCC vi vo thung',
    items: [
      { receiptItemId: fullReceipt.data.items[1].id, quantity: 2, reason: 'Vo thung / khong dat chat luong' },
    ],
  })
  await request('POST', `/stock/returns/${supplierReturn.data.id}/refunds`, {
    amount: 170000,
    paymentMethod: 'BANK',
    notes: 'NCC hoan tien mot phan hang tra',
  })
  console.log('Created supplier return and refund')

  console.log('Inventory procurement demo complete')
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
