import re

with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = "case 'code': return ("
end_marker = "case 'actions': return ("
end_marker_full = "                  </td>\n                );" # end of actions block

start_idx = text.find(start_marker)
actions_idx = text.find(end_marker)

if start_idx != -1 and actions_idx != -1:
    before = text[:start_idx]
    # find where actions block ends
    actions_end = text.find(end_marker_full, actions_idx) + len(end_marker_full)
    
    after = text[actions_end:]
    
    new_switch = '''case 'code': return (
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
    with open('apps/web/src/app/(dashboard)/orders/_components/order-list.tsx', 'w', encoding='utf-8') as f:
        f.write(before + new_switch + after)
    print("Fixed switch")
else:
    print("Not found indices", start_idx, actions_idx)
