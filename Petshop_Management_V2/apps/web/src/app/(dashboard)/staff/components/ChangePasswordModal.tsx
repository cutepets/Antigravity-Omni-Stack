import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog'

interface ChangePasswordModalProps {
  staffId: string
  selfUpdate?: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ChangePasswordModal({ staffId, selfUpdate = false, onClose, onSuccess }: ChangePasswordModalProps) {
  return (
    <ChangePasswordDialog
      open
      staffId={staffId}
      selfUpdate={selfUpdate}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onSuccess={onSuccess}
    />
  )
}
