const fs = require('fs');
const path = 'apps/web/src/app/(dashboard)/orders/_components/order-list.tsx';
let content = fs.readFileSync(path, 'utf8');

const colTypesOriginal = `type DisplayColumnId = 'code' | 'customer' | 'items' | 'total' | 'payment' | 'status' | 'created' | 'actions'`;
const colTypesNew = `type DisplayColumnId = 'code' | 'customer' | 'items' | 'total' | 'customerPaid' | 'payment' | 'status' | 'branch' | 'creator' | 'created' | 'updated'`;
content = content.replace(colTypesOriginal, colTypesNew);

const colOptionsRegex = /const COLUMN_OPTIONS: Array<\{ id: DisplayColumnId; label: string; sortable\?: boolean; width\?: string; minWidth\?: string \}> = \[[\s\S]*?\]/;
const colOptionsNew = `const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
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
]`;
content = content.replace(colOptionsRegex, colOptionsNew);

const initColsOriginal = `initialVisibleColumns: ['code', 'customer', 'items', 'total', 'payment', 'status', 'created', 'actions'],`;
const initColsNew = `initialVisibleColumns: ['code', 'customer', 'items', 'total', 'customerPaid', 'payment', 'status', 'branch', 'creator', 'created', 'updated'],`;
content = content.replace(initColsOriginal, initColsNew);

const switchRegex = /case 'code': return \([\s\S]*?case 'actions': return \([\s\S]*?<\/td>\n\s*\);\n/;
const switchNew = `case 'code': return (
                  <td key={columnId} className="px-3 py-3 w-24">
                    <span 
                       onClick={() => window.open(\`/pos?orderId=\${o.id}\`, '_blank')}
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
`;
content = content.replace(switchRegex, switchNew);

fs.writeFileSync(path, content, 'utf8');
console.log('Done script');
