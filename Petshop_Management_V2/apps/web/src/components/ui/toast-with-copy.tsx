import { toast, ExternalToast } from 'sonner'
import React from 'react'

const copyToClipboard = (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
  }
}

const withCopyAction = (message: string | React.ReactNode, data?: ExternalToast): ExternalToast => {
  const messageStr = typeof message === 'string' ? message : 'Copied content'

  return {
    ...data,
    action: data?.action || {
      label: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      ),
      onClick: () => {
        copyToClipboard(messageStr)
        toast.success("Đã copy nội dung")
      }
    }
  }
}

export const customToast = {
  ...toast,
  success: (message: string | React.ReactNode, data?: ExternalToast) => {
    return toast.success(message, withCopyAction(message, data))
  },
  error: (message: string | React.ReactNode, data?: ExternalToast) => {
    return toast.error(message, withCopyAction(message, data))
  },
  info: (message: string | React.ReactNode, data?: ExternalToast) => {
    return toast.info(message, withCopyAction(message, data))
  },
  warning: (message: string | React.ReactNode, data?: ExternalToast) => {
    return toast.warning(message, withCopyAction(message, data))
  },
  message: (message: string | React.ReactNode, data?: ExternalToast) => {
    return toast.message(message, withCopyAction(message, data))
  },
} as typeof toast

