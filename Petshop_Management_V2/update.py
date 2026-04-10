import re

with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update DisplayColumnId
text = text.replace(
    "type DisplayColumnId = 'code' | 'customer' | 'items' | 'total' | 'customerPaid' | 'payment' | 'status' | 'branch' | 'creator' | 'created' | 'updated'",
    "type DisplayColumnId = 'code' | 'customer' | 'customerPhone' | 'items' | 'discount' | 'shippingFee' | 'total' | 'customerPaid' | 'payment' | 'status' | 'linkedCodes' | 'note' | 'branch' | 'creator' | 'created' | 'updated'"
)

# 2. Update COLUMN_OPTIONS
new_cols = """const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
  { id: 'code',         label: 'Mã đơn',         sortable: false, width: 'w-24' },
  { id: 'customer',     label: 'Tên khách',      sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'customerPhone',label: 'SĐT Khách',      sortable: false, width: 'whitespace-nowrap' },
  { id: 'items',        label: 'Số SP',          sortable: false, width: 'whitespace-nowrap' },
  { id: 'discount',     label: 'Chiết khấu',      sortable: false, width: 'w-28', align: 'right' },
  { id: 'shippingFee',  label: 'Phí ship',       sortable: false, width: 'w-28', align: 'right' },
  { id: 'total',        label: 'Tổng tiền',      sortable: false, width: 'w-28', align: 'right' },
  { id: 'customerPaid', label: 'Khách đã trả',   sortable: false, width: 'w-28', align: 'right' },
  { id: 'payment',      label: 'TT',             sortable: false, width: 'w-32' },
  { id: 'status',       label: 'Trạng thái',     sortable: false, width: 'w-32' },
  { id: 'linkedCodes',  label: 'Mã liên kết',     sortable: false, minWidth: 'min-w-[180px]' },
  { id: 'note',         label: 'Ghi chú',        sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'branch',       label: 'Chi nhánh',      sortable: false, width: 'whitespace-nowrap' },
  { id: 'creator',      label: 'Người tạo',      sortable: false, width: 'whitespace-nowrap' },
  { id: 'created',      label: 'Ngày tạo',       sortable: false, width: 'whitespace-nowrap' },
  { id: 'updated',      label: 'Thời gian cập nhật',  sortable: false, width: 'whitespace-nowrap' },
]"""

text = re.sub(r'const COLUMN_OPTIONS:.*?\]\n', new_cols + '\n', text, flags=re.DOTALL)

# 3. Handle 'customer' block to remove phone, add phone block, discount, fee, linkedCodes, note.
old_customer_block = """                case 'customer': return (
                  <td key={columnId} className="px-3 py-3 min-w-[150px]">
                    <div className="font-semibold text-foreground text-sm">
                      {o.customer?.name || o.customer?.fullName || 'Khách lẻ'}
                    </div>
                    {(o.customer?.phone) && (
                      <div className="text-xs text-foreground-muted mt-0.5">{o.customer.phone}</div>
                    )}
                  </td>
                );"""

new_customer_and_friends = """                case 'customer': return (
                  <td key={columnId} className="px-3 py-3 min-w-[150px]">
                    <div className="font-semibold text-foreground text-sm">
                      {o.customer?.name || o.customer?.fullName || 'Khách lẻ'}
                    </div>
                  </td>
                );
                case 'customerPhone': return (
                  <td key={columnId} className="px-3 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground-secondary">
                      {o.customer?.phone || '--'}
                    </div>
                  </td>
                );
                case 'discount': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-medium text-foreground-secondary">
                      {formatCurrency(o.discount || 0)}
                    </div>
                  </td>
                );
                case 'shippingFee': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-medium text-foreground-secondary">
                      {formatCurrency(o.shippingFee || 0)}
                    </div>
                  </td>
                );
                case 'linkedCodes': return (
                  <td key={columnId} className="px-3 py-3 min-w-[180px]">
                    <div className="flex flex-wrap gap-1">
                      {o.transactions?.map((t: any, idx: number) => (
                        <span key={'tx-'+idx} className={px-1.5 py-0.5 rounded-md text-[10px] font-medium }>
                          {t.type === 'INCOME' ? 'PT' : 'PC'}: {t.voucherNumber}
                        </span>
                      ))}
                      {o.groomingSessions?.map((s: any, idx: number) => (
                        <span key={'gr-'+idx} className="bg-primary/10 text-primary-700 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                          SPA: {s.sessionCode}
                        </span>
                      ))}
                      {o.hotelStays?.map((h: any, idx: number) => (
                        <span key={'ht-'+idx} className="bg-warning/10 text-warning-700 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                          HOTEL: {h.stayCode}
                        </span>
                      ))}
                      {!(o.transactions?.length) && !(o.groomingSessions?.length) && !(o.hotelStays?.length) && (
                        <span className="text-xs text-foreground-muted">--</span>
                      )}
                    </div>
                  </td>
                );
                case 'note': return (
                  <td key={columnId} className="px-3 py-3 min-w-[150px]">
                    <div className="text-xs text-foreground-secondary line-clamp-2" title={o.notes || ''}>
                      {o.notes || '--'}
                    </div>
                  </td>
                );"""

text = text.replace(old_customer_block, new_customer_and_friends)

with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done update order-list.tsx')
