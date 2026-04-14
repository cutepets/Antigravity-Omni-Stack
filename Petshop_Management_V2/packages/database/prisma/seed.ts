import { PrismaClient, StockCountShift } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const NOW = new Date('2026-04-13T09:00:00+07:00')

const branchSeeds = [
  { id: 'branch-main', code: 'MAIN', name: 'Showroom Trung Tam', address: '12 Nguyen Hue, Quan 1, TP HCM', phone: '02871000001', email: 'main@petcare.local', isMain: true },
  { id: 'branch-bt', code: 'BT', name: 'Chi Nhanh Binh Thanh', address: '88 Xo Viet Nghe Tinh, Binh Thanh, TP HCM', phone: '02871000002', email: 'bt@petcare.local', isMain: false },
  { id: 'branch-q7', code: 'Q7', name: 'Chi Nhanh Quan 7', address: '41 Nguyen Thi Thap, Quan 7, TP HCM', phone: '02871000003', email: 'q7@petcare.local', isMain: false },
] as const

const roleSeeds = [
  { code: 'SUPER_ADMIN', name: 'Chủ cửa hàng', isSystem: true, permissions: ['MANAGE_STAFF', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_BRANCHES', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'VIEW_FINANCIAL_REPORTS', 'FULL_BRANCH_ACCESS', 'stock_count.create', 'stock_count.read', 'stock_count.update', 'stock_count.count', 'stock_count.approve'] },
  { code: 'ADMIN', name: 'Quản trị viên', isSystem: true, permissions: ['MANAGE_STAFF', 'MANAGE_BRANCHES', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'VIEW_FINANCIAL_REPORTS', 'stock_count.create', 'stock_count.read', 'stock_count.update', 'stock_count.count', 'stock_count.approve'] },
  { code: 'MANAGER', name: 'Cửa hàng trưởng', isSystem: false, permissions: ['MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'VIEW_FINANCIAL_REPORTS', 'stock_count.create', 'stock_count.read', 'stock_count.update', 'stock_count.count', 'stock_count.approve'] },
  { code: 'STAFF', name: 'Nhân viên vận hành', isSystem: false, permissions: ['MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'stock_count.read', 'stock_count.count'] },
] as const

const customerGroups = [
  { key: 'VIP', name: 'Thân thiết VIP', color: '#f59e0b', discount: 10, pricePolicy: 'Giá VIP', isDefault: false },
  { key: 'LOYAL', name: 'Thành viên', color: '#22c55e', discount: 5, pricePolicy: 'Giá thành viên', isDefault: true },
  { key: 'SPA', name: 'Spa care', color: '#0ea5e9', discount: 7, pricePolicy: 'Combo grooming', isDefault: false },
  { key: 'HOTEL', name: 'Hotel care', color: '#a855f7', discount: 6, pricePolicy: 'Combo lưu trú', isDefault: false },
] as const

const supplierSeeds = [
  { key: 'SUP1', name: 'Royal Pet Trading', phone: '0919000101', email: 'royal@petcare.local', address: 'Kho A, Thủ Đức, TP HCM', monthTarget: 18_000_000, yearTarget: 210_000_000, notes: 'Đối tác chiến lược cho nhóm thức ăn chó.', debt: 0, creditBalance: 0 },
  { key: 'SUP2', name: 'Bio Groom Viet Nam', phone: '0919000102', email: 'bio@petcare.local', address: 'Kho B, Dĩ An, Bình Dương', monthTarget: 12_000_000, yearTarget: 150_000_000, notes: 'Chuyên hàng grooming, shampoo và chăm sóc lông.', debt: 0, creditBalance: 0 },
  { key: 'SUP3', name: 'PetStyle Accessory', phone: '0919000103', email: 'style@petcare.local', address: 'Kho C, Gò Vấp, TP HCM', monthTarget: 14_000_000, yearTarget: 170_000_000, notes: 'Nguồn phụ kiện chủ lực cho chuỗi cửa hàng.', debt: 0, creditBalance: 0 },
  { key: 'SUP4', name: 'Vet Plus Pharma', phone: '0919000104', email: 'vet@petcare.local', address: 'Kho D, Biên Hòa, Đồng Nai', monthTarget: 10_000_000, yearTarget: 120_000_000, notes: 'NCC thuốc và bổ trợ sức khỏe cho thú cưng.', debt: 0, creditBalance: 0 },
  { key: 'SUP5', name: 'Natural Cat Litter', phone: '0919000105', email: 'litter@petcare.local', address: 'Kho E, Hóc Môn, TP HCM', monthTarget: 8_000_000, yearTarget: 95_000_000, notes: 'Tập trung cát vệ sinh và xịt khử mùi.', debt: 0, creditBalance: 0 },
  { key: 'SUP6', name: 'Happy Bark Foods', phone: '0919000106', email: 'bark@petcare.local', address: 'Kho F, Tân Phú, TP HCM', monthTarget: 15_000_000, yearTarget: 190_000_000, notes: 'Nhập pate, snack và thức ăn mèo/chó quay vòng nhanh.', debt: 0, creditBalance: 0 },
] as const

const productSeeds = [
  ['DOGFOOD001', 'Hạt Royal Canin Mini Adult 2kg', 'Thức ăn', 'Royal Canin', 'gói', 325000, 248000, 'Chó', 'MON_A', 'SUP1'],
  ['DOGFOOD002', 'Hạt SmartHeart Puppy 10kg', 'Thức ăn', 'SmartHeart', 'gói', 420000, 315000, 'Chó', 'MON_A', 'SUP1'],
  ['DOGFOOD003', 'Hạt Orijen Original 340g', 'Thức ăn', 'Orijen', 'gói', 285000, 228000, 'Chó', 'MON_B', 'SUP1'],
  ['DOGFOOD004', 'Pate Happy Bark Chicken 375g', 'Thức ăn', 'Happy Bark Foods', 'hộp', 42000, 28000, 'Chó', 'TUE_A', 'SUP6'],
  ['DOGFOOD005', 'Pate VitaCraft Beef 80g', 'Thức ăn', 'VitaCraft', 'hộp', 38000, 24000, 'Chó', 'TUE_A', 'SUP6'],
  ['DOGFOOD006', 'Snack dental chew size S', 'Thức ăn', 'Happy Bark Foods', 'thanh', 26000, 16000, 'Chó', 'TUE_B', 'SUP6'],
  ['DOGFOOD007', 'Snack soft cube salmon', 'Thức ăn', 'Happy Bark Foods', 'gói', 55000, 35000, 'Chó', 'TUE_B', 'SUP6'],
  ['DOGFOOD008', 'Hạt Hill\'s Science Diet Adult 4kg', 'Thức ăn', 'Hill\'s', 'gói', 480000, 372000, 'Chó', 'WED_A', 'SUP1'],
  ['DOGFOOD009', 'Xúc xích dinh dưỡng cho chó', 'Thức ăn', 'PetBar', 'gói', 85000, 55000, 'Chó', 'WED_A', 'SUP6'],
  ['DOGFOOD010', 'Hạt Acana Puppy 6kg', 'Thức ăn', 'Acana', 'gói', 395000, 305000, 'Chó', 'WED_B', 'SUP1'],

  ['CATFOOD001', 'Hạt Me O Salmon 1.2kg', 'Thức ăn', 'Me O', 'gói', 128000, 89000, 'Mèo', 'WED_B', 'SUP6'],
  ['CATFOOD002', 'Pate Me O Tuna 80g', 'Thức ăn', 'Me O', 'hộp', 18000, 11500, 'Mèo', 'THU_A', 'SUP6'],
  ['CATFOOD003', 'Hạt Royal Canin Indoor 2kg', 'Thức ăn', 'Royal Canin', 'gói', 295000, 228000, 'Mèo', 'THU_A', 'SUP1'],
  ['CATFOOD004', 'Pate Whiskas Ocean Fish 85g', 'Thức ăn', 'Whiskas', 'hộp', 15000, 9500, 'Mèo', 'THU_B', 'SUP6'],
  ['CATFOOD005', 'Hạt Purina ONE Adult 1.5kg', 'Thức ăn', 'Purina', 'gói', 185000, 135000, 'Mèo', 'THU_B', 'SUP1'],
  ['CATFOOD006', 'Treat Temptation Classic 85g', 'Thức ăn', 'Temptations', 'gói', 48000, 30000, 'Mèo', 'FRI_A', 'SUP6'],
  ['CATFOOD007', 'Snack Ciao Tuna Stick 14g', 'Thức ăn', 'Ciao', 'gói', 18000, 11000, 'Mèo', 'FRI_A', 'SUP6'],
  ['CATFOOD008', 'Hạt Hill\'s Science Diet Cat 4kg', 'Thức ăn', 'Hill\'s', 'gói', 520000, 402000, 'Mèo', 'FRI_B', 'SUP1'],

  ['LITTER001', 'Cát vệ sinh than hoạt tính 10L', 'Vệ sinh', 'Natural Cat Litter', 'gói', 145000, 98000, 'Mèo', 'FRI_B', 'SUP5'],
  ['LITTER002', 'Cát vệ sinh tinh thể silica 3.8L', 'Vệ sinh', 'Crystal Sand', 'gói', 95000, 62000, 'Mèo', 'SAT_A', 'SUP5'],
  ['LITTER003', 'Xịt khử mùi cát 500ml', 'Vệ sinh', 'Bio Care', 'chai', 92000, 62000, 'Chó & Mèo', 'SAT_A', 'SUP2'],
  ['BATH001', 'Sữa tắm cho lông trắng 500ml', 'Vệ sinh', 'Bio Care', 'chai', 138000, 92000, 'Chó & Mèo', 'SAT_B', 'SUP2'],
  ['BATH002', 'Sữa tắm hypoallergenic 500ml', 'Vệ sinh', 'Bio Care', 'chai', 168000, 118000, 'Chó & Mèo', 'SAT_B', 'SUP2'],
  ['BATH003', 'Sữa tắm khô (không xả nước)', 'Vệ sinh', 'PetStyle', 'chai', 145000, 95000, 'Chó & Mèo', 'SAT_A', 'SUP3'],
  ['BATH004', 'Khăn tắm khô siêu hút nước', 'Vệ sinh', 'PetStyle', 'cái', 99000, 65000, 'Chó & Mèo', 'SAT_A', 'SUP3'],
  ['BATH005', 'Nước hoa thú cưng 50ml', 'Vệ sinh', 'PawScent', 'chai', 78000, 48000, 'Chó & Mèo', 'SAT_A', 'SUP2'],

  ['ACCESS001', 'Dây đai nylon size M', 'Phụ kiện', 'PetStyle', 'cái', 115000, 72000, 'Chó', 'SAT_A', 'SUP3'],
  ['ACCESS002', 'Vòng cổ da có khắc tên', 'Phụ kiện', 'PetStyle', 'cái', 145000, 98000, 'Chó & Mèo', 'MON_A', 'SUP3'],
  ['ACCESS003', 'Bát ăn inox chống trượt size S', 'Phụ kiện', 'PetStyle', 'cái', 76000, 43000, 'Chó & Mèo', 'MON_A', 'SUP3'],
  ['ACCESS004', 'Lồng vận chuyển size M', 'Phụ kiện', 'PetStyle', 'cái', 420000, 305000, 'Chó & Mèo', 'MON_B', 'SUP3'],
  ['ACCESS005', 'Áo mưa chó mini', 'Phụ kiện', 'PetStyle', 'cái', 85000, 52000, 'Chó', 'MON_B', 'SUP3'],
  ['ACCESS006', 'Đồ chơi dây thừng kéo co', 'Phụ kiện', 'FunPet', 'cái', 65000, 38000, 'Chó', 'TUE_A', 'SUP3'],
  ['ACCESS007', 'Bóng cao su phát tiếng kêu', 'Phụ kiện', 'FunPet', 'cái', 45000, 26000, 'Chó', 'TUE_A', 'SUP3'],
  ['ACCESS008', 'Nhà cát mèo 3 tầng', 'Phụ kiện', 'PetStyle', 'cái', 850000, 620000, 'Mèo', 'TUE_B', 'SUP3'],
  ['ACCESS009', 'Cần câu lông vũ cho mèo', 'Phụ kiện', 'FunPet', 'cái', 55000, 32000, 'Mèo', 'TUE_B', 'SUP3'],
  ['ACCESS010', 'Bàn gãi móng sisal', 'Phụ kiện', 'PetStyle', 'cái', 195000, 145000, 'Mèo', 'WED_A', 'SUP3'],

  ['CARE001', 'Vitamin da và lông 60 viên', 'Chăm sóc', 'Dr Pet', 'hộp', 195000, 132000, 'Chó & Mèo', 'WED_A', 'SUP4'],
  ['CARE002', 'Men tiêu hóa thú cưng 30 gói', 'Chăm sóc', 'Dr Pet', 'hộp', 172000, 118000, 'Chó & Mèo', 'WED_B', 'SUP4'],
  ['CARE003', 'Xịt dưỡng lông silk finish', 'Chăm sóc', 'Bio Care', 'chai', 149000, 101000, 'Chó & Mèo', 'WED_B', 'SUP2'],
  ['CARE004', 'Kem dưỡng chân nứt nẻ', 'Chăm sóc', 'Dr Pet', 'chai', 110000, 73000, 'Chó', 'THU_A', 'SUP4'],
  ['CARE005', 'Dầu cá Omega-3 cho pet 60ml', 'Chăm sóc', 'NutriPet', 'chai', 155000, 110000, 'Chó & Mèo', 'THU_A', 'SUP4'],
  ['CARE006', 'Bột tắm khô cho chó size S', 'Chăm sóc', 'Bio Care', 'gói', 68000, 42000, 'Chó', 'THU_B', 'SUP2'],
  ['CARE007', 'Gel làm trắng răng không flo 50g', 'Chăm sóc', 'PetDent', 'tuýp', 89000, 55000, 'Chó & Mèo', 'THU_B', 'SUP4'],
  ['CARE008', 'Thuốc nhỏ mắt dưỡng ẩm 10ml', 'Chăm sóc', 'Virbac', 'chai', 95000, 65000, 'Chó & Mèo', 'FRI_A', 'SUP4'],

  ['MED001', 'Thuốc nhỏ vệ sinh tai 60ml', 'Thuốc', 'Virbac', 'chai', 210000, 154000, 'Chó & Mèo', 'FRI_A', 'SUP4'],
  ['MED002', 'Thuốc nhỏ trị bọ chét dưới 20kg', 'Thuốc', 'Virbac', 'hộp', 285000, 214000, 'Chó', 'FRI_B', 'SUP4'],
  ['MED003', 'Gel rửa mắt cho mèo 100ml', 'Thuốc', 'Virbac', 'chai', 158000, 109000, 'Mèo', 'FRI_B', 'SUP4'],
  ['MED004', 'Thuốc tẩy giun 4 con/hộp', 'Thuốc', 'Dr Pet', 'hộp', 125000, 88000, 'Chó & Mèo', 'SAT_A', 'SUP4'],
  ['MED005', 'Kháng sinh dạng uống 50ml', 'Thuốc', 'Vetcare', 'chai', 178000, 129000, 'Chó & Mèo', 'SAT_A', 'SUP4'],
  ['MED006', 'Xịt kháng khuẩn vết thương 100ml', 'Thuốc', 'Vetcare', 'chai', 145000, 105000, 'Chó & Mèo', 'SAT_B', 'SUP4'],
] as const

const customerSeeds = [
  // --- VIP tier (6 khách) ---
  { name: 'Trần Minh Anh',   phone: '0901111001', tier: 'PLATINUM', group: 'VIP',   debt: 0 },
  { name: 'Lê Thị Bảo Châu', phone: '0901111002', tier: 'PLATINUM', group: 'VIP',   debt: 0 },
  { name: 'Nguyễn Hoàng Nam', phone: '0901111003', tier: 'PLATINUM', group: 'VIP',   debt: 350000 },
  { name: 'Phạm Gia Hân',    phone: '0901111004', tier: 'PLATINUM', group: 'VIP',   debt: 0 },
  { name: 'Đoàn Thanh Vỹ',   phone: '0901111005', tier: 'PLATINUM', group: 'VIP',   debt: 0 },
  { name: 'Võ Quốc Huy',     phone: '0901111006', tier: 'PLATINUM', group: 'VIP',   debt: 0 },

  // --- GOLD tier / Spa Care (10 khách) ---
  { name: 'Nguyễn Kim Anh',  phone: '0901111007', tier: 'GOLD', group: 'SPA', debt: 0 },
  { name: 'Đặng Phương Linh',phone: '0901111008', tier: 'GOLD', group: 'SPA', debt: 180000 },
  { name: 'Bùi Tuấn Kiệt',  phone: '0901111009', tier: 'GOLD', group: 'SPA', debt: 0 },
  { name: 'Cao Mỹ Duyên KH', phone: '0901111010', tier: 'GOLD', group: 'SPA', debt: 0 },
  { name: 'Ngô Đức Long',    phone: '0901111011', tier: 'GOLD', group: 'SPA', debt: 0 },
  { name: 'Vũ Thanh Mai',    phone: '0901111012', tier: 'GOLD', group: 'SPA', debt: 0 },
  { name: 'Lý Cẩm Tú',      phone: '0901111013', tier: 'GOLD', group: 'SPA', debt: 0 },
  { name: 'Huỳnh Đăng Duy',  phone: '0901111014', tier: 'GOLD', group: 'SPA', debt: 225000 },
  { name: 'Phan Hoài Phúc',  phone: '0901111015', tier: 'GOLD', group: 'SPA', debt: 0 },
  { name: 'Lê Khánh Chi',    phone: '0901111016', tier: 'GOLD', group: 'SPA', debt: 0 },

  // --- GOLD tier / Hotel Care (8 khách) ---
  { name: 'Trương Gia Bảo',  phone: '0901111017', tier: 'GOLD',   group: 'HOTEL', debt: 0 },
  { name: 'Phạm Tấn Tài',    phone: '0901111018', tier: 'GOLD',   group: 'HOTEL', debt: 0 },
  { name: 'Dương Thu Hà',    phone: '0901111019', tier: 'GOLD',   group: 'HOTEL', debt: 0 },
  { name: 'Lâm Nhã Uyên KH', phone: '0901111020', tier: 'GOLD',   group: 'HOTEL', debt: 120000 },
  { name: 'Châu Mạnh Cường', phone: '0901111021', tier: 'GOLD',   group: 'HOTEL', debt: 0 },
  { name: 'Tôn Nhật Hà',     phone: '0901111022', tier: 'SILVER', group: 'HOTEL', debt: 0 },
  { name: 'Ngô Bảo Trâm',    phone: '0901111023', tier: 'SILVER', group: 'HOTEL', debt: 0 },
  { name: 'Đinh Phú Cường',  phone: '0901111024', tier: 'SILVER', group: 'HOTEL', debt: 0 },

  // --- SILVER/BRONZE / Thành viên thường (16 khách) ---
  { name: 'Hoàng Thị Lan',   phone: '0901111025', tier: 'SILVER', group: 'LOYAL', debt: 0 },
  { name: 'Đỗ Văn Minh',     phone: '0901111026', tier: 'SILVER', group: 'LOYAL', debt: 0 },
  { name: 'Bạch Thị Ngọc',   phone: '0901111027', tier: 'SILVER', group: 'LOYAL', debt: 75000 },
  { name: 'Trịnh Hoài Nam',  phone: '0901111028', tier: 'SILVER', group: 'LOYAL', debt: 0 },
  { name: 'Lưu Thị Hương',   phone: '0901111029', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Hà Văn Tùng',     phone: '0901111030', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Kiều Thị Thảo',   phone: '0901111031', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Vương Minh Hiếu', phone: '0901111032', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Quách Thị Ngân',  phone: '0901111033', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Tạ Văn Đức',      phone: '0901111034', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Mã Thị Liên',     phone: '0901111035', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Sơn Thị Thúy',    phone: '0901111036', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Dư Văn Hải',      phone: '0901111037', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Vòng Thị Kiều',   phone: '0901111038', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Ân Thị Ngọc',     phone: '0901111039', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
  { name: 'Khương Văn Bình', phone: '0901111040', tier: 'BRONZE', group: 'LOYAL', debt: 0 },
] as const

const streets = [
  'Nguyễn Huệ, Quận 1', 'Võ Văn Tần, Quận 3', 'Xô Viết Nghệ Tĩnh, Bình Thạnh', 'Nguyễn Thị Thập, Quận 7',
  'Kha Vạn Cân, Thủ Đức', 'Lê Văn Sỹ, Phú Nhuận', 'Phan Văn Trị, Gò Vấp', 'Trần Xuân Soạn, Quận 7',
] as const

const petNames = [
  'Mochi', 'Biscuit', 'Cookie', 'Bun', 'Milo', 'Latte', 'Tofu', 'Sunny', 'Luna', 'Bobo',
  'Misa', 'Benji', 'Gấu', 'Suri', 'Peanut', 'Mew', 'Pika', 'Kuma', 'Mint', 'Tiger',
  'Choco', 'Nori', 'Daisy', 'Neo', 'Mimi', 'Snow', 'Bambi', 'Olive', 'Rex', 'Mocha',
  'Bella', 'Max', 'Lucy', 'Charlie', 'Leo', 'Kitty', 'Oreo', 'Smokey', 'Simba', 'Loki',
  'Chloe', 'Nani', 'Lily', 'Ruby', 'Bear', 'Teddy', 'Duke', 'Buddy', 'Rocky', 'Buster'
] as const

const dogBreeds = ['Poodle', 'Corgi', 'Pomeranian', 'Golden Retriever', 'Pug', 'Shiba', 'Samoyed', 'French Bulldog', 'Maltese', 'Mini Schnauzer', 'Labrador', 'Husky', 'Chihuahua', 'Beagle'] as const
const catBreeds = ['British Shorthair', 'Munchkin', 'Siamese', 'Scottish Fold', 'Persian', 'Ragdoll', 'Bengal', 'Birman', 'Abyssinian', 'American Curl'] as const
const allergiesOptions = ['Dị ứng mùi nước hoa', 'Tránh hóa chất mạnh', 'Dị ứng thức ăn có tôm', null, null, null, null, null, null, null] as const
const temperaments = ['Thân thiện', 'Nhút nhát', 'Hiếu động', 'Cẩn thận khi gặp chó lạ', 'Cần bịt mõm khi spa', 'Quấn chủ', 'Sợ sấm sét'] as const

function addDays(base: Date, offset: number) {
  const value = new Date(base)
  value.setDate(value.getDate() + offset)
  return value
}

function setTime(base: Date, hour: number, minute = 0) {
  const value = new Date(base)
  value.setHours(hour, minute, 0, 0)
  return value
}

function sequentialCode(prefix: string, sequence: number, padLength = 6) {
  return `${prefix}${String(sequence).padStart(padLength, '0')}`
}

function orderNumber(date: Date, sequence: number) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `DH${y}${m}${d}${String(sequence).padStart(4, '0')}`
}

function hotelCode(date: Date, branchCode: string, sequence: number) {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `H${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`
}

function groomingCode(date: Date, branchCode: string, sequence: number) {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `S${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`
}

function voucher(type: 'INCOME' | 'EXPENSE', date: Date, sequence: number) {
  const prefix = type === 'INCOME' ? 'PT' : 'PC'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}${y}${m}${d}${String(sequence).padStart(4, '0')}`
}

function procurementNumber(prefix: string, date: Date, sequence: number, padLength = 3) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}${y}${m}${d}${String(sequence).padStart(padLength, '0')}`
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

async function main() {
  console.log('Seeding standardized demo data...')

  await prisma.$transaction([
    prisma.transaction.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.orderPayment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.groomingSession.deleteMany(),
    prisma.hotelStayAdjustment.deleteMany(),
    prisma.hotelStayChargeLine.deleteMany(),
    prisma.hotelStay.deleteMany(),
    prisma.supplierReturnRefund.deleteMany(),
    prisma.supplierReturnItem.deleteMany(),
    prisma.supplierReturn.deleteMany(),
    prisma.supplierPaymentAllocation.deleteMany(),
    prisma.supplierPayment.deleteMany(),
    prisma.stockReceiptReceiveItem.deleteMany(),
    prisma.stockReceiptReceive.deleteMany(),
    prisma.stockTransaction.deleteMany(),
    prisma.stockCountItem.deleteMany(),
    prisma.stockCountShiftSession.deleteMany(),
    prisma.stockCountSession.deleteMany(),
    prisma.stockReceiptItem.deleteMany(),
    prisma.stockReceipt.deleteMany(),
    prisma.branchStock.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.serviceVariant.deleteMany(),
    prisma.service.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.petVaccination.deleteMany(),
    prisma.petWeightLog.deleteMany(),
    prisma.petHealthNote.deleteMany(),
    prisma.pet.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.customerGroup.deleteMany(),
    prisma.hotelPriceRule.deleteMany(),
    prisma.holidayCalendarDate.deleteMany(),
    prisma.hotelRateTable.deleteMany(),
    prisma.serviceWeightBand.deleteMany(),
    prisma.cage.deleteMany(),
    prisma.priceBook.deleteMany(),
    prisma.category.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.shiftSession.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
    prisma.branch.deleteMany()
  ])

  const branchMap = new Map<string, any>()
  for (const seed of branchSeeds) {
    const branch = await prisma.branch.create({
      data: { id: seed.id, code: seed.code, name: seed.name, address: seed.address, phone: seed.phone, email: seed.email, isMain: seed.isMain, isActive: true } as any,
    })
    branchMap.set(seed.code, branch)
  }

  const roleMap = new Map<string, any>()
  for (const seed of roleSeeds) {
    const role = await prisma.role.create({
      data: { code: seed.code, name: seed.name, isSystem: seed.isSystem, permissions: seed.permissions as any, description: `${seed.name} standard role` } as any,
    })
    roleMap.set(seed.code, role)
  }

  await prisma.systemConfig.upsert({
    where: { id: 'system-config-main' },
    update: {
      shopName: 'PetCare Unified Demo',
      shopPhone: '02871008888',
      shopAddress: '12 Nguyễn Huệ, Quận 1, TP HCM',
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      loyaltySpendPerPoint: 1000,
      loyaltyPointValue: 100,
      loyaltyPointExpiryMonths: 24,
      loyaltyTierRetentionMonths: 12,
    } as any,
    create: {
      id: 'system-config-main',
      shopName: 'PetCare Unified Demo',
      shopPhone: '02871008888',
      shopAddress: '12 Nguyễn Huệ, Quận 1, TP HCM',
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      loyaltySpendPerPoint: 1000,
      loyaltyPointValue: 100,
      loyaltyPointExpiryMonths: 24,
      loyaltyTierRetentionMonths: 12,
    } as any,
  })

  const hashes = {
    admin: await bcrypt.hash('Admin@123', 12),
    staff: await bcrypt.hash('Staff@123', 12),
  }

  const userSeeds = [
    { username: 'superadmin', fullName: 'Trần Văn Hùng', roleCode: 'SUPER_ADMIN', branchCode: 'MAIN', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 0, phone: '0901234501', gender: 'MALE', dob: new Date('1990-01-01') },
    { username: 'admin', fullName: 'Nguyễn Thị Lan', roleCode: 'ADMIN', branchCode: 'MAIN', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 0, phone: '0901234502', gender: 'FEMALE', dob: new Date('1992-05-15') },
    { username: 'manager', fullName: 'Lê Quốc Bảo', roleCode: 'MANAGER', branchCode: 'MAIN', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 12000000, phone: '0901234503', gender: 'MALE', dob: new Date('1993-08-20') },
    { username: 'manager_bt', fullName: 'Phạm Thị Hoa', roleCode: 'MANAGER', branchCode: 'BT', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 11000000, phone: '0901234504', gender: 'FEMALE', dob: new Date('1991-11-10') },
    { username: 'manager_q7', fullName: 'Võ Minh Khoa', roleCode: 'MANAGER', branchCode: 'Q7', shiftStart: '09:00', shiftEnd: '18:00', baseSalary: 11000000, phone: '0901234505', gender: 'MALE', dob: new Date('1994-03-25') },
    { username: 'cashier01', fullName: 'Đặng Thị Thu', roleCode: 'STAFF', branchCode: 'MAIN', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 7500000, phone: '0901234506', gender: 'FEMALE', dob: new Date('1998-07-12') },
    { username: 'cashier02', fullName: 'Bùi Thanh Tùng', roleCode: 'STAFF', branchCode: 'MAIN', shiftStart: '13:00', shiftEnd: '21:00', baseSalary: 7500000, phone: '0901234507', gender: 'MALE', dob: new Date('1999-02-28') },
    { username: 'groomer01', fullName: 'Cao Mỹ Duyên', roleCode: 'STAFF', branchCode: 'MAIN', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 8000000, phone: '0901234508', gender: 'FEMALE', dob: new Date('1996-09-05') },
    { username: 'groomer02', fullName: 'Ngô Thị Hà', roleCode: 'STAFF', branchCode: 'BT', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 8000000, phone: '0901234509', gender: 'FEMALE', dob: new Date('1995-12-18') },
    { username: 'groomer03', fullName: 'Hồ Văn Tiến', roleCode: 'STAFF', branchCode: 'Q7', shiftStart: '09:00', shiftEnd: '18:00', baseSalary: 8000000, phone: '0901234510', gender: 'MALE', dob: new Date('1997-04-14') },
    { username: 'groomer04', fullName: 'Trương Thị Bích', roleCode: 'STAFF', branchCode: 'BT', shiftStart: '13:00', shiftEnd: '21:00', baseSalary: 7800000, phone: '0901234511', gender: 'FEMALE', dob: new Date('2000-10-30') },
    { username: 'hotel01', fullName: 'Lý Thị Cam', roleCode: 'STAFF', branchCode: 'MAIN', shiftStart: '07:00', shiftEnd: '16:00', baseSalary: 7200000, phone: '0901234512', gender: 'FEMALE', dob: new Date('1998-06-22') },
    { username: 'hotel02', fullName: 'Huỳnh Đăng Khoa', roleCode: 'STAFF', branchCode: 'BT', shiftStart: '07:00', shiftEnd: '16:00', baseSalary: 7200000, phone: '0901234513', gender: 'MALE', dob: new Date('1999-01-05') },
    { username: 'hotel03', fullName: 'Mai Ngọc Yến', roleCode: 'STAFF', branchCode: 'Q7', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 7200000, phone: '0901234514', gender: 'FEMALE', dob: new Date('1997-08-19') },
    { username: 'receptionist01', fullName: 'Lâm Nhã Uyên', roleCode: 'STAFF', branchCode: 'MAIN', shiftStart: '08:00', shiftEnd: '17:00', baseSalary: 7000000, phone: '0901234515', gender: 'FEMALE', dob: new Date('2001-03-08') },
  ] as const

  const userMap = new Map<string, any>()
  for (let i=0; i<userSeeds.length; i++) {
    const seed = userSeeds[i]!
    const payload = {
      username: seed.username,
      staffCode: `NV${String(i+1).padStart(5, '0')}`,
      passwordHash: seed.roleCode.includes('ADMIN') ? hashes.admin : hashes.staff,
      fullName: seed.fullName,
      legacyRole: 'STAFF' as any,
      roleId: roleMap.get(seed.roleCode).id,
      status: 'WORKING',
      employmentType: 'FULL_TIME',
      branchId: branchMap.get(seed.branchCode).id,
      joinDate: new Date('2024-06-01T09:00:00+07:00'),
    }

    const user = await prisma.user.create({ data: payload as any })
    userMap.set(seed.username, user)
  }

  await prisma.category.createMany({ data: ['Thức ăn', 'Vệ sinh', 'Phụ kiện', 'Chăm sóc', 'Thuốc'].map((name) => ({ name, description: `${name} standard demo category` })) as any[] })
  await prisma.brand.createMany({ data: ['Royal Canin', 'SmartHeart', 'Orijen', 'Happy Bark Foods', 'VitaCraft', 'PetBar', 'Acana', 'Me O', 'Whiskas', 'Purina', 'Temptations', 'Ciao', 'Hill\'s', 'Natural Cat Litter', 'Crystal Sand', 'Bio Care', 'PetStyle', 'PawScent', 'FunPet', 'Dr Pet', 'NutriPet', 'PetDent', 'Virbac', 'Vetcare'].map((name) => ({ name })) as any[] })
  await prisma.unit.createMany({ data: ['gói', 'chai', 'hộp', 'cái', 'thanh', 'tuýp'].map((name) => ({ name, description: `${name} unit` })) as any[] })
  await prisma.priceBook.createMany({
    data: [
      { name: 'Giá lẻ toàn hệ thống', channel: 'POS', isDefault: true, isActive: true, sortOrder: 1 },
      { name: 'Giá combo grooming', channel: 'SPA', isDefault: false, isActive: true, sortOrder: 2 },
      { name: 'Giá lưu trú qua đêm', channel: 'HOTEL', isDefault: false, isActive: true, sortOrder: 3 },
    ] as any[],
  })

  const groupMap = new Map<string, any>()
  for (const seed of customerGroups) {
    const group = await prisma.customerGroup.create({
      data: { name: seed.name, color: seed.color, discount: seed.discount, pricePolicy: seed.pricePolicy, isDefault: seed.isDefault, description: `${seed.name} standard demo group` } as any,
    })
    groupMap.set(seed.key, group)
  }

  const supplierMap = new Map<string, any>()
  for (const seed of supplierSeeds) {
    const supplier = await prisma.supplier.create({
      data: {
        name: seed.name,
        phone: seed.phone,
        email: seed.email,
        address: seed.address,
        notes: seed.notes,
        monthTarget: seed.monthTarget,
        yearTarget: seed.yearTarget,
        isActive: true,
      } as any,
    })
    supplierMap.set(seed.key, supplier)
  }

  const serviceMap = new Map<string, any>()
  const serviceSeeds = [
    { key: 'SVCGROOM001', code: 'SVCGROOM001', name: 'Tắm sấy cơ bản', type: 'GROOMING', price: 180000, duration: 60 },
    { key: 'SVCGROOM002', code: 'SVCGROOM002', name: 'Tắm sấy + cắt tỉa chó nhỏ', type: 'GROOMING', price: 250000, duration: 90 },
    { key: 'SVCGROOM003', code: 'SVCGROOM003', name: 'Tắm sấy + cắt tỉa chó lớn', type: 'GROOMING', price: 360000, duration: 120 },
    { key: 'SVCGROOM004', code: 'SVCGROOM004', name: 'Spa mèo lông ngắn', type: 'GROOMING', price: 220000, duration: 75 },
    { key: 'SVCGROOM005', code: 'SVCGROOM005', name: 'Spa mèo lông dài', type: 'GROOMING', price: 295000, duration: 105 },
    { key: 'SVCGROOM006', code: 'SVCGROOM006', name: 'Spa detox da nhạy cảm', type: 'GROOMING', price: 320000, duration: 105 },
    { key: 'SVCGROOM007', code: 'SVCGROOM007', name: 'Gội đầu dưỡng lông Olaplex', type: 'GROOMING', price: 180000, duration: 45 },
    { key: 'SVCGROOM008', code: 'SVCGROOM008', name: 'Cắt móng + vệ sinh tai', type: 'GROOMING', price: 95000, duration: 30 },
    { key: 'SVCGROOM009', code: 'SVCGROOM009', name: 'Tẩy ố lông vàng lông trắng', type: 'GROOMING', price: 245000, duration: 90 },
    { key: 'SVCGROOM010', code: 'SVCGROOM010', name: 'Massage thư giãn 30 phút', type: 'GROOMING', price: 150000, duration: 30 },
    { key: 'SVCGROOM011', code: 'SVCGROOM011', name: 'Tắm sấy + cắt tỉa chó XL', type: 'GROOMING', price: 450000, duration: 150 },
    { key: 'SVCGROOM012', code: 'SVCGROOM012', name: 'Combo full service (tắm+cắt+spa)', type: 'GROOMING', price: 520000, duration: 180 },
    { key: 'SVCHOTEL001', code: 'SVCHOTEL001', name: 'Chuồng tiêu chuẩn (chó nhỏ)', type: 'HOTEL', price: 190000, duration: null },
    { key: 'SVCHOTEL002', code: 'SVCHOTEL002', name: 'Chuồng tiêu chuẩn (chó lớn)', type: 'HOTEL', price: 240000, duration: null },
    { key: 'SVCHOTEL003', code: 'SVCHOTEL003', name: 'Phòng mèo premium', type: 'HOTEL', price: 170000, duration: null },
    { key: 'SVCHOTEL004', code: 'SVCHOTEL004', name: 'Phòng VIP điều hòa', type: 'HOTEL', price: 320000, duration: null },
    { key: 'SVCHOTEL005', code: 'SVCHOTEL005', name: 'Phòng VIP ban công', type: 'HOTEL', price: 380000, duration: null },
    { key: 'SVCHOTEL006', code: 'SVCHOTEL006', name: 'Chuồng phòng ngủ qua đêm', type: 'HOTEL', price: 210000, duration: null },
    { key: 'SVCHOTEL007', code: 'SVCHOTEL007', name: 'Gói daycare (7h–19h)', type: 'HOTEL', price: 130000, duration: null },
    { key: 'SVCHOTEL008', code: 'SVCHOTEL008', name: 'Gói daycare + tắm sấy', type: 'HOTEL', price: 260000, duration: null },
  ] as const
  for (const seed of serviceSeeds) {
    const service = await prisma.service.create({
      data: { name: seed.name, code: seed.code, type: seed.type as any, description: `${seed.name} standard demo service`, price: seed.price, duration: seed.duration, isActive: true } as any,
    })
    serviceMap.set(seed.key, service)
  }
  await prisma.serviceVariant.createMany({
    data: [
      { serviceId: serviceMap.get('SVCGROOM002').id, name: 'Chó nhỏ dưới 5kg', price: 250000, duration: 90 },
      { serviceId: serviceMap.get('SVCGROOM002').id, name: 'Chó 5kg đến 10kg', price: 320000, duration: 110 },
      { serviceId: serviceMap.get('SVCGROOM003').id, name: 'Chó lớn trên 10kg', price: 360000, duration: 120 },
      { serviceId: serviceMap.get('SVCGROOM004').id, name: 'Mèo lông ngắn', price: 220000, duration: 75 },
      { serviceId: serviceMap.get('SVCGROOM005').id, name: 'Mèo lông dài', price: 295000, duration: 105 },
      { serviceId: serviceMap.get('SVCHOTEL001').id, name: 'Chuồng tiêu chuẩn', price: 190000, duration: null },
      { serviceId: serviceMap.get('SVCHOTEL003').id, name: 'Phòng mèo premium', price: 170000, duration: null },
    ] as any[],
  })

  // Using the original 12 cages
  const cageMap = new Map<string, any>()
  for (const [name, type] of [
    ['A01', 'REGULAR'], ['A02', 'REGULAR'], ['A03', 'REGULAR'], ['A04', 'REGULAR'], ['A05', 'REGULAR'], ['A06', 'REGULAR'],
    ['B01', 'REGULAR'], ['B02', 'REGULAR'], ['B03', 'REGULAR'],
    ['C01', 'REGULAR'], ['C02', 'REGULAR'], ['C03', 'REGULAR'],
    ['VIP01', 'HOLIDAY'], ['VIP02', 'HOLIDAY'], ['VIP03', 'HOLIDAY'],
  ] as const) {
    const cage = await prisma.cage.create({
      data: { name, type: type as any, description: `${name} standard hotel cage`, isActive: true } as any,
    })
    cageMap.set(name, cage)
  }

  const rateTableMap = new Map<string, any>()
  for (const seed of [
    { key: 'DOG_SMALL', name: 'Bảng giá chó nhỏ 2026', species: 'Chó', minWeight: 0, maxWeight: 5, lineType: 'REGULAR', ratePerNight: 190000 },
    { key: 'DOG_MEDIUM', name: 'Bảng giá chó vừa 2026', species: 'Chó', minWeight: 5, maxWeight: 12, lineType: 'REGULAR', ratePerNight: 240000 },
    { key: 'DOG_LARGE', name: 'Bảng giá chó lớn 2026', species: 'Chó', minWeight: 12, maxWeight: 35, lineType: 'REGULAR', ratePerNight: 260000 },
    { key: 'CAT_STD', name: 'Bảng giá mèo 2026', species: 'Mèo', minWeight: 0, maxWeight: 10, lineType: 'REGULAR', ratePerNight: 170000 },
    { key: 'VIP_ALL', name: 'Bảng giá phòng VIP 2026', species: null, minWeight: 0, maxWeight: 40, lineType: 'HOLIDAY', ratePerNight: 320000 },
  ] as const) {
    const rate = await prisma.hotelRateTable.create({
      data: { name: seed.name, year: 2026, species: seed.species, minWeight: seed.minWeight, maxWeight: seed.maxWeight, lineType: seed.lineType as any, ratePerNight: seed.ratePerNight, isActive: true } as any,
    })
    rateTableMap.set(seed.key, rate)
  }

  const hotelWeightBandMap = new Map<string, any>()
  for (const [index, seed] of [
    { key: 'LT2', label: '<2kg', minWeight: 0, maxWeight: 2 },
    { key: '2_4', label: '2-4kg', minWeight: 2, maxWeight: 4 },
    { key: '4_6', label: '4-6kg', minWeight: 4, maxWeight: 6 },
    { key: '6_9', label: '6-9kg', minWeight: 6, maxWeight: 9 },
    { key: '9_12', label: '9-12kg', minWeight: 9, maxWeight: 12 },
    { key: '12_15', label: '12-15kg', minWeight: 12, maxWeight: 15 },
    { key: '15_20', label: '15-20kg', minWeight: 15, maxWeight: 20 },
    { key: '20_30', label: '20-30kg', minWeight: 20, maxWeight: 30 },
    { key: '30_40', label: '30-40kg', minWeight: 30, maxWeight: 40 },
    { key: '40_50', label: '40-50kg', minWeight: 40, maxWeight: 50 },
    { key: 'GT50', label: '>50kg', minWeight: 50, maxWeight: null },
  ].entries()) {
    const band = await prisma.serviceWeightBand.create({
      data: {
        serviceType: 'HOTEL',
        species: null,
        label: seed.label,
        minWeight: seed.minWeight,
        maxWeight: seed.maxWeight,
        sortOrder: index,
        isActive: true,
      } as any,
    })
    hotelWeightBandMap.set(seed.key, band)
  }

  const branchPricingAdjustments: Record<string, number> = {
    MAIN: 0,
    BT: 10000,
    Q7: 20000,
  }

  for (const [bandIndex, bandKey] of [...hotelWeightBandMap.keys()].entries()) {
    const baseRegular = 140000 + bandIndex * 20000
    const baseHoliday = Math.round(baseRegular * 1.3)
    const weightBandId = hotelWeightBandMap.get(bandKey).id

    for (const [branchCode, branchDelta] of Object.entries(branchPricingAdjustments)) {
      await prisma.hotelPriceRule.createMany({
        data: [
          {
            year: 2026,
            branchId: branchMap.get(branchCode).id,
            species: null,
            weightBandId,
            dayType: 'REGULAR',
            fullDayPrice: baseRegular + branchDelta,
            halfDayPrice: Math.round((baseRegular + branchDelta) / 2),
            isActive: true,
          },
          {
            year: 2026,
            branchId: branchMap.get(branchCode).id,
            species: null,
            weightBandId,
            dayType: 'HOLIDAY',
            fullDayPrice: baseHoliday + branchDelta,
            halfDayPrice: Math.round((baseHoliday + branchDelta) / 2),
            isActive: true,
          },
        ] as any[],
      })
    }
  }

  await prisma.holidayCalendarDate.createMany({
    data: [
      {
        date: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        year: 2026,
        name: 'Tet Duong lich',
        isRecurring: true,
        isActive: true,
      },
      {
        date: new Date('2026-09-02T00:00:00.000Z'),
        endDate: new Date('2026-09-02T00:00:00.000Z'),
        year: 2026,
        name: 'Quoc khanh',
        isRecurring: true,
        isActive: true,
      },
    ] as any[],
  })

  const customerMap = new Map<string, any>()
  for (let index = 0; index < customerSeeds.length; index += 1) {
    const seed = customerSeeds[index]!
    const code = sequentialCode('KH', index + 1)
    const email = `${seed.name.toLowerCase().replace(/\s+/g, '.')}@petcare.local`
    
    // Convert Vietnamese to lowercase no diacritics for realistic email (simple version)
    const cleanEmail = email.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")

    const customer = await prisma.customer.create({
      data: {
        customerCode: code,
        fullName: seed.name,
        phone: seed.phone,
        email: cleanEmail,
        address: `${12 + index * 3} ${streets[index % streets.length]}`,
        tier: seed.tier as any,
        points: 0,
        pointsUsed: index % 5 === 0 ? 40 : 0,
        groupId: groupMap.get(seed.group).id,
        notes: `Demo customer ${code}`,
        debt: seed.debt,
        totalSpent: 0,
        totalOrders: 0,
        isActive: true,
        createdAt: setTime(addDays(NOW, -(30 - index)), 9 + (index % 6), 10),
      } as any,
    })
    customerMap.set(code, customer)
  }

  const petMap = new Map<string, any>()
  for (let index = 0; index < petNames.length; index += 1) {
    const name = petNames[index]!
    const code = sequentialCode('PET', index + 1)
    const customerIdx = index % customerSeeds.length
    const customerCode = sequentialCode('KH', customerIdx + 1)
    const customerInfo = customerSeeds[customerIdx]!
    const species = index % 5 < 3 ? 'Chó' : 'Mèo' // 30 dogs, 20 cats
    const breed = species === 'Chó' ? dogBreeds[index % dogBreeds.length]! : catBreeds[index % catBreeds.length]!
    const hasChip = index % 3 === 0
    
    const pet = await prisma.pet.create({
      data: {
        petCode: code,
        name,
        species,
        breed,
        gender: index % 2 === 0 ? 'MALE' : 'FEMALE',
        weight: species === 'Chó' ? 2.5 + (index % 30) : 2.5 + (index % 5),
        color: index % 4 === 0 ? 'Kem trắng' : index % 4 === 1 ? 'Socola nâu' : index % 4 === 2 ? 'Xám xanh' : 'Vàng cam',
        microchipId: hasChip ? `CHIP${String(index+1).padStart(5, '0')}` : null,
        allergies: allergiesOptions[index % allergiesOptions.length],
        temperament: temperaments[index % temperaments.length],
        customerId: customerMap.get(customerCode).id,
        notes: `Thú cưng ${name} của ${customerInfo.name}`,
        createdAt: setTime(addDays(NOW, -(20 + index)), 10, 0),
      } as any,
    })
    petMap.set(code, pet)
    
    // Add health records
    await prisma.petWeightLog.createMany({
      data: [
        { petId: pet.id, weight: pet.weight! - 0.5, date: addDays(NOW, -90), notes: 'Sức khỏe bình thường' },
        { petId: pet.id, weight: pet.weight!, date: addDays(NOW, -30), notes: 'Tăng cân đều' },
      ] as any[]
    })
    
    await prisma.petVaccination.create({
      data: {
        petId: pet.id,
        vaccineName: species === 'Chó' ? 'Vaccine 7 bệnh' : 'Vaccine 4 bệnh',
        date: addDays(NOW, -180),
        nextDueDate: addDays(NOW, 180),
      } as any
    })
    
    if (customerInfo.tier === 'PLATINUM' || customerInfo.tier === 'GOLD') {
      await prisma.petHealthNote.create({
        data: {
          petId: pet.id,
          content: `Khám định kỳ tổng quát. Tình trạng tốt. Cần lưu ý chế độ ăn.`,
          date: addDays(NOW, -15),
        } as any
      })
    }
  }

  const categoryMap = new Map<string, any>()
  const cats = await prisma.category.findMany()
  cats.forEach((c) => categoryMap.set(c.name, c))

  const brandMap = new Map<string, any>()
  const brds = await prisma.brand.findMany()
  brds.forEach((b) => brandMap.set(b.name, b))

  const unitMap = new Map<string, any>()
  const uns = await prisma.unit.findMany()
  uns.forEach((u) => unitMap.set(u.name, u))

  const posPriceBook = await prisma.priceBook.findFirst({ where: { channel: 'POS' } })

  const productMap = new Map<string, any>()
  for (const [code, name, categoryName, brandName, unitName, price, costPrice, targetSpecies, countShift, supKey] of productSeeds) {
    const id = `prod-${code.toLowerCase()}`
    const p = await prisma.product.create({
      data: {
        id,
        sku: code,
        name,
        targetSpecies,
        lastCountShift: countShift as StockCountShift,
        price,
        costPrice,
        category: categoryName,
        brand: brandName,
        unit: unitName,
        supplierId: supplierMap.get(supKey).id,
        isActive: true,
      } as any,
    })
    productMap.set(code, p)

    await prisma.productVariant.create({
      data: { sku: code, barcode: `893${code.slice(-6)}${code.slice(-4, -1)}`, name, productId: p.id, price, costPrice, isActive: true } as any,
    })

    for (const bCode of ['MAIN', 'BT', 'Q7']) {
      await prisma.branchStock.create({
        data: { branchId: branchMap.get(bCode).id, productId: p.id, stock: 50, minStock: 20 } as any,
      })
    }
  }

  // Stock Receipts - 30 receipts
  console.log('Seeding stock receipts...')
  const rxStatuses = [
    'FULLY_PAID', 'FULLY_PAID', 'FULLY_PAID', 'FULLY_PAID', 'FULLY_PAID', 'FULLY_PAID', 'FULLY_PAID',
    'FULLY_PARTIAL', 'FULLY_PARTIAL', 'FULLY_PARTIAL', 'FULLY_PARTIAL', 'FULLY_PARTIAL', 'FULLY_PARTIAL',
    'PARTIAL_RECEIVED', 'PARTIAL_RECEIVED', 'PARTIAL_RECEIVED', 'PARTIAL_RECEIVED', 'PARTIAL_RECEIVED', 'PARTIAL_RECEIVED',
    'SHORT_CLOSED', 'SHORT_CLOSED', 'SHORT_CLOSED', 'SHORT_CLOSED', 'SHORT_CLOSED',
    'PREPAID_DRAFT', 'PREPAID_DRAFT', 'PREPAID_DRAFT', 'PREPAID_DRAFT',
    'CANCELLED', 'CANCELLED'
  ]

  for (let index = 0; index < 30; index += 1) {
    const rxDate = addDays(NOW, -(30 - index))
    const status = rxStatuses[index]!
    const supplier = supplierMap.get(`SUP${(index % 6) + 1}`)!
    
    let dbStatus = 'DRAFT'
    let receiveStatus = 'UNRECEIVED'
    let paymentStatus = 'UNPAID'
    
    if (status === 'FULLY_PAID') { dbStatus = 'COMPLETED'; receiveStatus = 'FULLY_RECEIVED'; paymentStatus = 'PAID' }
    if (status === 'FULLY_PARTIAL') { dbStatus = 'COMPLETED'; receiveStatus = 'FULLY_RECEIVED'; paymentStatus = 'PARTIAL' }
    if (status === 'PARTIAL_RECEIVED') { dbStatus = 'PARTIAL'; receiveStatus = 'PARTIAL'; paymentStatus = 'UNPAID' }
    if (status === 'SHORT_CLOSED') { dbStatus = 'COMPLETED'; receiveStatus = 'PARTIAL'; paymentStatus = 'PAID' }
    if (status === 'PREPAID_DRAFT') { dbStatus = 'DRAFT'; receiveStatus = 'UNRECEIVED'; paymentStatus = 'PARTIAL' }
    if (status === 'CANCELLED') { dbStatus = 'CANCELLED'; receiveStatus = 'UNRECEIVED'; paymentStatus = 'UNPAID' }

    const rx = await prisma.stockReceipt.create({
      data: {
        receiptNumber: procurementNumber('PN', rxDate, index + 1, 4),
        branch: { connect: { id: branchMap.get('MAIN').id } },
        supplier: { connect: { id: supplier.id } },
        status: dbStatus as any,
        receiptStatus: receiveStatus as any,
        paymentStatus: paymentStatus as any,
        totalAmount: 5000000,
        paidAmount: paymentStatus === 'PAID' ? 5000000 : paymentStatus === 'PARTIAL' ? 2500000 : 0,
        notes: `Phiếu nhập hàng tự động ${index + 1}`,
        createdAt: rxDate,
        updatedAt: rxDate,
      } as any,
    })

    // Receipt items
    const pv1 = await prisma.productVariant.findFirst({ where: { sku: productSeeds[index % 50]![0] } })
    const pv2 = await prisma.productVariant.findFirst({ where: { sku: productSeeds[(index + 1) % 50]![0] } })
    
    if (pv1 && pv2) {
      const ri1 = await prisma.stockReceiptItem.create({
        data: { receiptId: rx.id, productId: pv1.productId, productVariantId: pv1.id, quantity: 100, unitPrice: pv1.costPrice || 0, totalPrice: (pv1.costPrice || 0) * 100 } as any
      })
      const ri2 = await prisma.stockReceiptItem.create({
        data: { receiptId: rx.id, productId: pv2.productId, productVariantId: pv2.id, quantity: 100, unitPrice: pv2.costPrice || 0, totalPrice: (pv2.costPrice || 0) * 100 } as any
      })
      
      // Stock Receive
      if (receiveStatus !== 'UNRECEIVED') {
        const sr = await prisma.stockReceiptReceive.create({
          data: {
            receiveNumber: `PNK${Date.now()}`,
            receiptId: rx.id,
            branchId: branchMap.get('MAIN').id,
            staffId: userMap.get('manager').id,
            totalQuantity: receiveStatus === 'PARTIAL' ? 100 : 200,
            totalAmount: receiveStatus === 'PARTIAL' ? (pv1.costPrice || 0) * 100 : 5000000,
            receivedAt: setTime(rxDate, 14),
          } as any
        })
        
        await prisma.stockReceiptReceiveItem.create({
          data: { receiveId: sr.id, receiptItemId: ri1.id, productId: pv1.productId, productVariantId: pv1.id, quantity: 100, unitPrice: pv1.costPrice || 0, totalPrice: (pv1.costPrice || 0) * 100 } as any
        })
        if (receiveStatus !== 'PARTIAL') {
          await prisma.stockReceiptReceiveItem.create({
            data: { receiveId: sr.id, receiptItemId: ri2.id, productId: pv2.productId, productVariantId: pv2.id, quantity: 100, unitPrice: pv2.costPrice || 0, totalPrice: (pv2.costPrice || 0) * 100 } as any
          })
        }
        
        // Stock Transactions
        const branchStock1 = await prisma.branchStock.findFirst({ where: { branchId: branchMap.get('MAIN').id, productId: pv1.productId } })
        if (branchStock1) {
          await prisma.stockTransaction.create({
            data: {
              productId: pv1.productId,
              productVariantId: pv1.id,
              type: 'RECEIPT',
              quantity: 100,
              reason: 'Nhập kho từ phiếu ' + rx.receiptNumber,
              referenceId: sr.id,
            } as any
          })
          await prisma.branchStock.update({ where: { id: branchStock1.id }, data: { stock: { increment: 100 } } })
        }
      }
      
      // Payment
      if (paymentStatus !== 'UNPAID') {
        const payAmount = paymentStatus === 'PAID' ? 5000000 : 2500000
        const py = await prisma.supplierPayment.create({
          data: {
            paymentNumber: procurementNumber('PCN', setTime(rxDate, 15), index + 1, 4),
            branchId: branchMap.get('MAIN').id,
            supplierId: supplier.id,
            staffId: userMap.get('admin').id,
            amount: payAmount,
            paymentMethod: 'BANK_TRANSFER',
            paidAt: setTime(rxDate, 15),
            notes: 'Thanh toán nhập hàng',
            createdAt: setTime(rxDate, 15)
          } as any
        })
        
        await prisma.supplierPaymentAllocation.create({
          data: { paymentId: py.id, receiptId: rx.id, amount: payAmount, createdAt: setTime(rxDate, 15) } as any
        })
      }
    }
  }

  // Orders - 50 orders
  console.log('Seeding orders...')
  for (let index = 0; index < 50; index += 1) {
    const oDate = addDays(NOW, -(50 - index))
    const code = orderNumber(oDate, index + 1)
    const orderType = index < 20 ? 'RETAIL' : index < 36 ? 'GROOMING' : 'HOTEL'
    
    let oStatus = 'COMPLETED'
    let pStatus = 'PAID'
    
    // Distribution: 35 COMPLETED/PAID, 8 COMPLETED/PARTIAL, 4 PENDING, 3 CANCELLED
    if (index >= 35 && index < 43) pStatus = 'PARTIAL'
    if (index >= 43 && index < 47) { oStatus = 'PENDING'; pStatus = 'UNPAID' }
    if (index >= 47) { oStatus = 'CANCELLED'; pStatus = 'UNPAID' }

    const pv1 = await prisma.productVariant.findFirst({ where: { sku: productSeeds[index % 50]![0] } })
    const customerCode = sequentialCode('KH', (index % 40) + 1)
    const customer = customerMap.get(customerCode)

    const order = await prisma.order.create({
      data: {
        orderNumber: code,
        branchId: branchMap.get('MAIN').id,
        customerId: customer.id,
        customerName: customer.fullName,
        staffId: userMap.get('cashier01').id,
        status: oStatus as any,
        paymentStatus: pStatus as any,
        subtotal: 500000,
        discount: 0,
        total: 500000,
        paidAmount: pStatus === 'PAID' ? 500000 : pStatus === 'PARTIAL' ? 200000 : 0,
        remainingAmount: pStatus === 'PAID' ? 0 : pStatus === 'PARTIAL' ? 300000 : 500000,
        createdAt: oDate,
        updatedAt: oDate,
      } as any,
    })

    if (pv1 && orderType === 'RETAIL') {
      await prisma.orderItem.create({
        data: {
          orderId: order.id, productId: pv1.productId, productVariantId: pv1.id, description: pv1.name,
          quantity: 2, unitPrice: pv1.price, subtotal: pv1.price * 2, type: 'PRODUCT'
        } as any
      })
    }

    if (orderType === 'GROOMING') {
      const groomSvc = await prisma.service.findFirst({ where: { type: 'GROOMING' } })
      const petId = (await prisma.pet.findFirst({ where: { customerId: customer.id } }))?.id
      if (groomSvc && petId) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id, serviceId: groomSvc.id, description: groomSvc.name,
            quantity: 1, unitPrice: groomSvc.price, subtotal: groomSvc.price, type: 'SERVICE'
          } as any
        })
        
        await prisma.groomingSession.create({
          data: {
            sessionCode: groomingCode(oDate, 'MAIN', index + 1),
            branchId: branchMap.get('MAIN').id,
            orderId: order.id,
            customerId: customer.id,
            petId: petId,
            petName: (await prisma.pet.findUnique({ where: { id: petId } }))!.name,
            status: oStatus === 'COMPLETED' ? 'COMPLETED' : 'PENDING' as any,
            startTime: oStatus === 'COMPLETED' ? setTime(oDate, 10) : null,
            endTime: oStatus === 'COMPLETED' ? setTime(oDate, 11) : null,
            price: groomSvc.price,
            notes: 'Tắm sấy cơ bản',
            staffId: userMap.get('cashier01').id,
          } as any
        })
      }
    }

    if (orderType === 'HOTEL') {
      const hotelSvc = await prisma.service.findFirst({ where: { type: 'HOTEL' } })
      const petId = (await prisma.pet.findFirst({ where: { customerId: customer.id } }))?.id

      if (hotelSvc && petId) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id, serviceId: hotelSvc.id, description: hotelSvc.name,
            quantity: 2, unitPrice: hotelSvc.price, subtotal: hotelSvc.price * 2, type: 'SERVICE'
          } as any
        })
        
      }
    }

    // Transactions for Paid orders
    if (pStatus !== 'UNPAID') {
      const payAmount = pStatus === 'PAID' ? 500000 : 200000
      await prisma.orderPayment.create({
        data: {
          orderId: order.id, method: 'BANK_TRANSFER', amount: payAmount,
          createdAt: setTime(oDate, 10)
        } as any
      })
      
      await prisma.transaction.create({
        data: {
          voucherNumber: voucher('INCOME', setTime(oDate, 10), index + 1),
          branchId: branchMap.get('MAIN').id,
          type: 'INCOME',
          category: 'Bán hàng',
          amount: payAmount,
          paymentMethod: 'BANK_TRANSFER',
          description: `Thu tiền đơn hàng ${code}`,
          payerId: customer.id,
          payerName: customer.name,
          orderId: order.id,
          createdAt: setTime(oDate, 10),
        } as any
      })
    }
  }

  const hotelDemoSeeds: Array<{
    branchCode: string
    cageName: string | null
    petCode: string
    createdBy: string
    status: 'BOOKED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'
    startAt: Date
    expectedAt: Date
    createdAt: Date
    checkedInAt?: Date
    checkOutAt?: Date
    cancelledAt?: Date
    surcharge: number
    linkedOrder?: {
      status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED'
      paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'COMPLETED'
      paidAmount?: number
    }
    note: string
  }> = [
    {
      branchCode: 'MAIN',
      cageName: 'A02',
      petCode: 'PET000011',
      createdBy: 'hotel01',
      status: 'BOOKED',
      startAt: setTime(addDays(NOW, 1), 9),
      expectedAt: setTime(addDays(NOW, 3), 11),
      createdAt: setTime(NOW, 8, 15),
      surcharge: 20000,
      note: 'Demo đơn đặt lịch chi nhánh chính',
    },
    {
      branchCode: 'MAIN',
      cageName: 'A03',
      petCode: 'PET000012',
      createdBy: 'hotel01',
      status: 'CHECKED_IN',
      startAt: setTime(NOW, 8),
      expectedAt: setTime(addDays(NOW, 1), 10),
      checkedInAt: setTime(NOW, 8, 5),
      createdAt: setTime(NOW, 7, 45),
      surcharge: 35000,
      linkedOrder: {
        status: 'PROCESSING',
        paymentStatus: 'PARTIAL',
        paidAmount: 120000,
      },
      note: 'Demo thú cưng đang trông giữ',
    },
    {
      branchCode: 'MAIN',
      cageName: 'A04',
      petCode: 'PET000013',
      createdBy: 'hotel01',
      status: 'CHECKED_OUT',
      startAt: setTime(addDays(NOW, -1), 9),
      expectedAt: setTime(NOW, 10),
      checkedInAt: setTime(addDays(NOW, -1), 9, 10),
      checkOutAt: setTime(NOW, 10, 30),
      createdAt: setTime(addDays(NOW, -1), 8, 40),
      surcharge: 15000,
      linkedOrder: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      },
      note: 'Demo đơn đã trả hôm nay',
    },
    {
      branchCode: 'MAIN',
      cageName: null,
      petCode: 'PET000014',
      createdBy: 'hotel01',
      status: 'CANCELLED',
      startAt: setTime(addDays(NOW, 1), 8),
      expectedAt: setTime(addDays(NOW, 2), 10),
      cancelledAt: setTime(NOW, 9, 20),
      createdAt: setTime(NOW, 8, 50),
      surcharge: 0,
      note: 'Demo đơn hủy trong ngày',
    },
    {
      branchCode: 'BT',
      cageName: 'B01',
      petCode: 'PET000015',
      createdBy: 'hotel02',
      status: 'BOOKED',
      startAt: setTime(addDays(NOW, 1), 9),
      expectedAt: setTime(addDays(NOW, 2), 11),
      createdAt: setTime(NOW, 8, 10),
      surcharge: 10000,
      linkedOrder: {
        status: 'PENDING',
        paymentStatus: 'UNPAID',
      },
      note: 'Demo đặt lịch chi nhánh Bình Thạnh',
    },
    {
      branchCode: 'BT',
      cageName: 'B02',
      petCode: 'PET000016',
      createdBy: 'hotel02',
      status: 'CHECKED_IN',
      startAt: setTime(NOW, 7, 30),
      expectedAt: setTime(addDays(NOW, 2), 10),
      checkedInAt: setTime(NOW, 7, 40),
      createdAt: setTime(NOW, 7, 5),
      surcharge: 45000,
      note: 'Demo đang trông giữ chi nhánh Bình Thạnh',
    },
    {
      branchCode: 'BT',
      cageName: 'B03',
      petCode: 'PET000017',
      createdBy: 'hotel02',
      status: 'CHECKED_OUT',
      startAt: setTime(addDays(NOW, -2), 10),
      expectedAt: setTime(NOW, 11),
      checkedInAt: setTime(addDays(NOW, -2), 10, 5),
      checkOutAt: setTime(NOW, 11, 5),
      createdAt: setTime(addDays(NOW, -2), 9, 40),
      surcharge: 0,
      linkedOrder: {
        status: 'COMPLETED',
        paymentStatus: 'COMPLETED',
      },
      note: 'Demo đã trả trong ngày chi nhánh Bình Thạnh',
    },
    {
      branchCode: 'BT',
      cageName: null,
      petCode: 'PET000018',
      createdBy: 'hotel02',
      status: 'CANCELLED',
      startAt: setTime(addDays(NOW, 2), 9),
      expectedAt: setTime(addDays(NOW, 4), 10),
      cancelledAt: setTime(NOW, 11, 10),
      createdAt: setTime(NOW, 10, 15),
      surcharge: 0,
      note: 'Demo hủy chi nhánh Bình Thạnh',
    },
    {
      branchCode: 'Q7',
      cageName: 'C01',
      petCode: 'PET000019',
      createdBy: 'hotel03',
      status: 'BOOKED',
      startAt: setTime(addDays(NOW, 1), 10),
      expectedAt: setTime(addDays(NOW, 3), 11),
      createdAt: setTime(NOW, 9, 10),
      surcharge: 25000,
      note: 'Demo đặt lịch chi nhánh Quận 7',
    },
    {
      branchCode: 'Q7',
      cageName: 'C02',
      petCode: 'PET000020',
      createdBy: 'hotel03',
      status: 'CHECKED_IN',
      startAt: setTime(NOW, 9),
      expectedAt: setTime(addDays(NOW, 1), 9),
      checkedInAt: setTime(NOW, 9, 15),
      createdAt: setTime(NOW, 8, 30),
      surcharge: 30000,
      linkedOrder: {
        status: 'PROCESSING',
        paymentStatus: 'PARTIAL',
        paidAmount: 90000,
      },
      note: 'Demo đang trông giữ chi nhánh Quận 7',
    },
    {
      branchCode: 'Q7',
      cageName: 'C03',
      petCode: 'PET000021',
      createdBy: 'hotel03',
      status: 'CHECKED_OUT',
      startAt: setTime(addDays(NOW, -1), 8),
      expectedAt: setTime(NOW, 14),
      checkedInAt: setTime(addDays(NOW, -1), 8, 20),
      checkOutAt: setTime(NOW, 14, 5),
      createdAt: setTime(addDays(NOW, -1), 7, 40),
      surcharge: 0,
      linkedOrder: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      },
      note: 'Demo đã trả hôm nay chi nhánh Quận 7',
    },
    {
      branchCode: 'Q7',
      cageName: null,
      petCode: 'PET000022',
      createdBy: 'hotel03',
      status: 'CANCELLED',
      startAt: setTime(addDays(NOW, 2), 8),
      expectedAt: setTime(addDays(NOW, 5), 10),
      cancelledAt: setTime(NOW, 15, 15),
      createdAt: setTime(NOW, 14, 10),
      surcharge: 0,
      note: 'Demo hủy trong ngày chi nhánh Quận 7',
    },
  ]

  for (const [index, seed] of hotelDemoSeeds.entries()) {
    const pet = petMap.get(seed.petCode)
    const branch = branchMap.get(seed.branchCode)
    const createdBy = userMap.get(seed.createdBy)
    const cage = seed.cageName ? cageMap.get(seed.cageName) : null
    if (!pet || !branch || !createdBy) continue
    const customer = Array.from(customerMap.values()).find((item) => item.id === pet.customerId) ?? null

    const basePrice = 160000 + (index % 4) * 20000
    const totalPrice = basePrice + seed.surcharge
    const stay = await prisma.hotelStay.create({
      data: {
        stayCode: hotelCode(seed.createdAt, seed.branchCode, 300 + index + 1),
        branchId: branch.id,
        customerId: pet.customerId,
        petId: pet.id,
        petName: pet.name,
        cageId: cage?.id ?? null,
        createdById: createdBy.id,
        status: seed.status as any,
        checkIn: seed.startAt,
        estimatedCheckOut: seed.expectedAt,
        checkOut: seed.checkOutAt ?? null,
        checkOutActual: seed.checkOutAt ?? null,
        checkedInAt: seed.checkedInAt ?? null,
        cancelledAt: seed.cancelledAt ?? null,
        price: basePrice,
        dailyRate: basePrice,
        surcharge: seed.surcharge,
        totalPrice,
        paymentStatus: (seed.linkedOrder?.paymentStatus ?? 'UNPAID') as any,
        notes: seed.note,
        weightAtBooking: pet.weight ?? 0,
        createdAt: seed.createdAt,
      } as any,
    })

    if (seed.surcharge > 0) {
      await prisma.hotelStayAdjustment.create({
        data: {
          hotelStayId: stay.id,
          type: 'AGGRESSIVE',
          label: 'Phụ phí đặc biệt',
          amount: seed.surcharge,
          note: seed.status === 'CHECKED_IN' ? 'Theo dõi hành vi trong lúc lưu trú' : 'Phụ phí demo',
        } as any,
      })
    }

    if (seed.linkedOrder) {
      const hotelServiceCode =
        pet.species?.toUpperCase() === 'CAT'
          ? 'SVCHOTEL003'
          : totalPrice >= 260000
            ? 'SVCHOTEL004'
            : 'SVCHOTEL001'
      const hotelService = serviceMap.get(hotelServiceCode)
      const paidAmount =
        seed.linkedOrder.paidAmount ??
        (seed.linkedOrder.paymentStatus === 'UNPAID'
          ? 0
          : seed.linkedOrder.paymentStatus === 'PARTIAL'
            ? Math.round(totalPrice * 0.4)
            : totalPrice)
      const remainingAmount = Math.max(0, totalPrice - paidAmount)
      const paymentCreatedAt =
        seed.checkOutAt ?? seed.checkedInAt ?? setTime(seed.createdAt, seed.createdAt.getHours() + 1)

      const order = await prisma.order.create({
        data: {
          orderNumber: orderNumber(seed.createdAt, 500 + index + 1),
          branchId: branch.id,
          customerId: pet.customerId,
          customerName: customer?.fullName ?? pet.name,
          staffId: createdBy.id,
          status: seed.linkedOrder.status as any,
          paymentStatus: seed.linkedOrder.paymentStatus as any,
          subtotal: totalPrice,
          discount: 0,
          shippingFee: 0,
          total: totalPrice,
          paidAmount,
          remainingAmount,
          notes: `Đơn demo liên kết với phiếu hotel ${stay.stayCode}`,
          createdAt: seed.createdAt,
          updatedAt: seed.createdAt,
          ...(seed.linkedOrder.status === 'COMPLETED' && seed.checkOutAt ? { completedAt: seed.checkOutAt } : {}),
        } as any,
      })

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          serviceId: hotelService?.id ?? null,
          petId: pet.id,
          hotelStayId: stay.id,
          description: `${hotelService?.name ?? 'Dịch vụ hotel'} · ${stay.stayCode}`,
          quantity: 1,
          unitPrice: totalPrice,
          discountItem: 0,
          subtotal: totalPrice,
          type: 'SERVICE',
          createdAt: seed.createdAt,
        } as any,
      })

      if (paidAmount > 0) {
        const paymentMethod = paidAmount >= totalPrice ? 'CASH' : 'BANK_TRANSFER'

        await prisma.orderPayment.create({
          data: {
            orderId: order.id,
            method: paymentMethod,
            amount: paidAmount,
            note: 'Thanh toán demo cho đơn hotel',
            createdAt: paymentCreatedAt,
          } as any,
        })

        await prisma.transaction.create({
          data: {
            voucherNumber: voucher('INCOME', paymentCreatedAt, 500 + index + 1),
            branchId: branch.id,
            type: 'INCOME',
            category: 'Bán hàng',
            amount: paidAmount,
            paymentMethod,
            description: `Thu tiền đơn hotel ${order.orderNumber}`,
            payerId: pet.customerId,
            payerName: customer?.fullName ?? pet.name,
            orderId: order.id,
            createdAt: paymentCreatedAt,
          } as any,
        })
      }

      await prisma.hotelStay.update({
        where: { id: stay.id },
        data: {
          orderId: order.id,
          paymentStatus: seed.linkedOrder.paymentStatus as any,
        } as any,
      })
    }

    await prisma.activityLog.create({
      data: {
        userId: createdBy.id,
        action: 'HOTEL_STAY_CREATED',
        target: 'HOTEL_STAY',
        targetId: stay.id,
        details: {
          stayCode: stay.stayCode,
          branchId: branch.id,
          petName: pet.name,
        } as any,
        createdAt: seed.createdAt,
      } as any,
    })

    if (seed.checkedInAt) {
      await prisma.activityLog.create({
        data: {
          userId: createdBy.id,
          action: 'HOTEL_STAY_CHECKED_IN',
          target: 'HOTEL_STAY',
          targetId: stay.id,
          details: { stayCode: stay.stayCode } as any,
          createdAt: seed.checkedInAt,
        } as any,
      })
    }

    if (seed.checkOutAt) {
      await prisma.activityLog.create({
        data: {
          userId: createdBy.id,
          action: 'HOTEL_STAY_CHECKED_OUT',
          target: 'HOTEL_STAY',
          targetId: stay.id,
          details: { stayCode: stay.stayCode } as any,
          createdAt: seed.checkOutAt,
        } as any,
      })
    }

    if (seed.cancelledAt) {
      await prisma.activityLog.create({
        data: {
          userId: createdBy.id,
          action: 'HOTEL_STAY_CANCELLED',
          target: 'HOTEL_STAY',
          targetId: stay.id,
          details: { stayCode: stay.stayCode } as any,
          createdAt: seed.cancelledAt,
        } as any,
      })
    }
  }

  // Manual Transactions (10)
  for (let index = 0; index < 10; index += 1) {
    const tDate = addDays(NOW, -index)
    const isIncome = index === 0 || index === 1 || index === 8
    const type = isIncome ? 'INCOME' : 'EXPENSE'
    
    let desc = ''
    let cat = ''
    let amt = 0
    
    if (index === 0) { desc = 'Thu tiền thuê tủ trưng bày'; cat = 'Phụ thu'; amt = 2500000 }
    else if (index === 1) { desc = 'Thu đặt cọc sự kiện'; cat = 'Khác'; amt = 5000000 }
    else if (index === 2) { desc = 'Chi phí điện tháng 4'; cat = 'Vận hành'; amt = 3200000 }
    else if (index === 3) { desc = 'Chi phí thuê mặt bằng'; cat = 'Mặt bằng'; amt = 18000000 }
    else if (index === 4) { desc = 'Chi phí vật tư văn phòng'; cat = 'Hành chính'; amt = 85000 }
    else if (index === 5) { desc = 'Chi phí nhân viên part-time'; cat = 'Nhân sự'; amt = 2400000 }
    else if (index === 6) { desc = 'Chi phí sửa máy tắm'; cat = 'Bảo trì'; amt = 1200000 }
    else if (index === 7) { desc = 'Chi mua ghế ngồi chờ'; cat = 'Tài sản'; amt = 3500000 }
    else if (index === 8) { desc = 'Thu hoa hồng đại lý'; cat = 'Phụ thu'; amt = 1800000 }
    else { desc = 'Chi phí quảng cáo Facebook'; cat = 'Marketing'; amt = 2000000 }
    
    await prisma.transaction.create({
      data: {
        voucherNumber: voucher(type as any, tDate, 100 + index),
        branchId: branchMap.get('MAIN').id,
        type: type as any,
        category: cat,
        amount: amt,
        paymentMethod: 'CASH',
        description: desc,
        createdAt: tDate,
      } as any
    })
  }

  console.log('✓ Branches:     3')
  console.log('✓ Users:        15')
  console.log('✓ Categories:   5')
  console.log('✓ Brands:       24')
  console.log('✓ Units:        6')
  console.log('✓ Suppliers:    6')
  console.log('✓ Products:     50')
  console.log('✓ Customers:    40')
  console.log('✓ Pets:         50')
  console.log('✓ Receipts:     30')
  console.log('✓ Orders:       50')
  console.log('✓ Transactions: 50+ (Auto + 10 Manual)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
