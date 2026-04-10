import re

with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# I will find the exact boundaries.
# 'const COLUMN_OPTIONS:' down to ']\n' followed by '\nconst SORTABLE_COLUMNS'
start_marker = 'const COLUMN_OPTIONS:'
end_marker = '\nconst SORTABLE_COLUMNS'

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx != -1 and end_idx != -1:
    before = text[:start_idx]
    after = text[end_idx:]
    
    new_col_options = '''const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
  { id: 'code',         label: 'Mã đơn',         sortable: false, width: 'w-24' },
  { id: 'customer',     label: 'Khách hàng',     sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'items',        label: 'Số SP',          sortable: false, width: 'w-20' },
  { id: 'total',        label: 'Tổng tiền',      sortable: false, width: 'w-28', align: 'right' },
  { id: 'customerPaid', label: 'Khách đã trả',   sortable: false, width: 'w-28', align: 'right' },
  { id: 'payment',      label: 'TT',             sortable: false, width: 'w-32' },
  { id: 'status',       label: 'Trạng thái',     sortable: false, width: 'w-32' },
  { id: 'branch',       label: 'Chi nhánh',      sortable: false, width: 'w-28' },
  { id: 'creator',      label: 'Người tạo',      sortable: false, width: 'w-28' },
  { id: 'created',      label: 'Ngày tạo',       sortable: false, width: 'w-36' },
  { id: 'updated',      label: 'Thời gian cập nhật',  sortable: false, width: 'w-36' },
]'''

    with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'w', encoding='utf-8') as f:
        f.write(before + new_col_options + after)
        
    print('Fixed')
else:
    print('Boundaries not found')
