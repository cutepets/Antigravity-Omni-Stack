import re

with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Update COLUMN_OPTIONS
text = text.replace("{ id: 'items',        label: 'Số SP',          sortable: false, width: 'w-20' },", "{ id: 'items',        label: 'Số SP',          sortable: false, width: 'whitespace-nowrap' },")
text = text.replace("{ id: 'creator',      label: 'Người tạo',      sortable: false, width: 'w-28' },", "{ id: 'creator',      label: 'Người tạo',      sortable: false, width: 'whitespace-nowrap' },")
text = text.replace("{ id: 'created',      label: 'Ngày tạo',       sortable: false, width: 'w-36' },", "{ id: 'created',      label: 'Ngày tạo',       sortable: false, width: 'whitespace-nowrap' },")
text = text.replace("{ id: 'updated',      label: 'Thời gian cập nhật',  sortable: false, width: 'w-36' },", "{ id: 'updated',      label: 'Thời gian cập nhật',  sortable: false, width: 'whitespace-nowrap' },")

# Update table cells
# items
text = text.replace("className=\"px-3 py-3 w-20\"", "className=\"px-3 py-3 whitespace-nowrap\"")
# creator
text = text.replace("className=\"px-3 py-3 w-28\"", "className=\"px-3 py-3 whitespace-nowrap\"")
# created
text = text.replace("className=\"px-3 py-3 w-36 text-xs text-foreground-muted\"", "className=\"px-3 py-3 whitespace-nowrap text-xs text-foreground-muted\"")
# updated
# actually there are two w-36 occurrences in the file, both are created/updated
text = text.replace("className=\"px-3 py-3 w-36 text-xs text-foreground-muted\"", "className=\"px-3 py-3 whitespace-nowrap text-xs text-foreground-muted\"")

with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Updated spaces')
