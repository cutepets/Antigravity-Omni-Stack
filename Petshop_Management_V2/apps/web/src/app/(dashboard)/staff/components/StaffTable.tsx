import React from 'react'
import { Staff } from '@/lib/api/staff.api'
import { RoleGate } from '@/components/auth/RoleGate'

interface StaffTableProps {
  staffList: Staff[]
  onEdit: (staff: Staff) => void
  onDeactivate: (id: string, name: string) => void
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: '#dc2626',
  ADMIN: '#ea580c',
  MANAGER: '#ca8a04',
  STAFF: '#2563eb',
  VIEWER: '#64748b'
}

const STATUS_COLORS: Record<string, { bg: string, text: string }> = {
  WORKING: { bg: '#dcfce7', text: '#166534' },
  PROBATION: { bg: '#fef9c3', text: '#854d0e' },
  LEAVE: { bg: '#e0e7ff', text: '#3730a3' },
  RESIGNED: { bg: '#fee2e2', text: '#991b1b' },
  QUIT: { bg: '#fee2e2', text: '#991b1b' }
}

const STATUS_LABELS: Record<string, string> = {
  WORKING: 'Đang làm việc',
  PROBATION: 'Thử việc',
  LEAVE: 'Nghỉ phép',
  RESIGNED: 'Đã nghỉ việc',
  QUIT: 'Đã nghỉ việc'
}

export function StaffTable({ staffList, onEdit, onDeactivate }: StaffTableProps) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Mã NV</th>
              <th style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Nhân viên</th>
              <th style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Vai trò</th>
              <th style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Liên hệ</th>
              <th style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Trạng thái</th>
              <th style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {staffList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                  Không tìm thấy nhân viên nào
                </td>
              </tr>
            ) : (
              staffList.map((staff) => (
                <tr key={staff.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', fontWeight: 500, color: '#0f172a' }}>{staff.staffCode}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{staff.fullName}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>@{staff.username}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: 6, 
                      fontWeight: 600, 
                      fontSize: 12,
                      color: ROLE_COLORS[staff.role?.code || ''] || '#64748b',
                      background: `${ROLE_COLORS[staff.role?.code || ''] || '#64748b'}15`
                    }}>
                      {staff.role?.name || 'Chưa phân quyền'}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: 14, color: '#334155' }}>📞 {staff.phone || '---'}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>✉️ {staff.email || '---'}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: 12, 
                      fontSize: 12, 
                      fontWeight: 600,
                      background: STATUS_COLORS[staff.status]?.bg || '#f1f5f9',
                      color: STATUS_COLORS[staff.status]?.text || '#64748b'
                    }}>
                      {STATUS_LABELS[staff.status] || staff.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => onEdit(staff)}
                      style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 600, marginRight: 16 }}
                    >
                      Sửa
                    </button>
                    <RoleGate allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                      {staff.status !== 'RESIGNED' && staff.status !== 'QUIT' && (
                        <button 
                          onClick={() => onDeactivate(staff.id, staff.fullName)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Nghỉ việc
                        </button>
                      )}
                    </RoleGate>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
