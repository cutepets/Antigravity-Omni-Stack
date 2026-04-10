import re
with open(r'apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace COLUMN_OPTIONS
col_options_regex = re.compile(r'const COLUMN_OPTIONS:.*?\]', re.DOTALL)
col_options_replacement = '''const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
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
  { id: 'updated',      label: 'Ngày cập nhật',  sortable: false, width: 'w-36' },
]'''
content = col_options_regex.sub(col_options_replacement, content, count=1)

# Replace table switch rendering mapping
switch_regex = re.compile(r'case \'code\': return \(.*?case \'actions\': return \(.*?</td>\n\s*\);\n', re.DOTALL)
switch_replacement = '''case 'code': return (
                  <td key={columnId} className="px-3 py-3 w-24">
                    <span 
                       onClick={() => window.open(/pos?orderId=, '_blank')}
                       className="font-mono text-xs font-bold text-primary-500 hover:underline cursor-pointer transition-colors"
                    >
                      {o.orderNumber || '--'}
                    </span>
                  </td>
                );
                case 'customer': return (
                  <td key={columnId} className="px-3 py-3 min-w-[150px]">
                    <div className="font-semibold text-foreground text-sm">
                      {o.customer?.name || o.customer?.fullName || 'Khách lẻ'}
                    </div>
                    {(o.customer?.phone) && (
                      <div className="text-xs text-foreground-muted mt-0.5">{o.customer.phone}</div>
                    )}
                  </td>
                );
                case 'items': return (
                  <td key={columnId} className="px-3 py-3 w-20">
                    <div className="inline-flex items-center gap-1.5 bg-background-tertiary px-2 py-0.5 rounded-md">
                      <ShoppingBag size={11} className="text-foreground-muted" />
                      <span className="text-xs font-medium text-foreground-secondary">{o.items?.length || 0} SP</span>
                    </div>
                  </td>
                );
                case 'total': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-bold text-foreground">
                      {formatCurrency(o.total)}
                    </div>
                  </td>
                );
                case 'customerPaid': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(o.paidAmount || 0)}
                    </div>
                  </td>
                );
                case 'payment': return (
                  <td key={columnId} className="px-3 py-3 w-32">
                    <div className="flex items-center gap-1.5 text-xs text-foreground-secondary font-medium">
                      <CreditCard size={13} className="text-foreground-muted" />
                      {getOrderPaymentLabel(o)}
                    </div>
                  </td>
                );
                case 'status': return (
                  <td key={columnId} className="px-3 py-3 w-32">
                    <StatusBadge status={o.paymentStatus} />
                  </td>
                );
                case 'branch': return (
                  <td key={columnId} className="px-3 py-3 w-28">
                    <div className="text-xs text-foreground-secondary font-medium">
                      {o.branch?.name || '--'}
                    </div>
                  </td>
                );
                case 'creator': return (
                  <td key={columnId} className="px-3 py-3 w-28">
                    <div className="text-xs text-foreground-secondary">
                      {o.staff?.fullName || o.staff?.name || '--'}
                    </div>
                  </td>
                );
                case 'created': return (
                  <td key={columnId} className="px-3 py-3 w-36 text-xs text-foreground-muted">
                    <div className="flex items-center gap-1">
                      <CalendarDays size={12}/>
                      {o.createdAt ? formatDateTime(o.createdAt) : '--'}
                    </div>
                  </td>
                );
                case 'updated': return (
                  <td key={columnId} className="px-3 py-3 w-36 text-xs text-foreground-muted">
                    <div className="flex items-center gap-1">
                      <CalendarDays size={12}/>
                      {o.updatedAt ? formatDateTime(o.updatedAt) : '--'}
                    </div>
                  </td>
                );
'''
content = switch_regex.sub(switch_replacement, content, count=1)

with open(r'apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
