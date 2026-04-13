'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  EmployeeDocument,
  DocumentType,
  staffApi,
  UploadDocumentDto,
} from '@/lib/api/staff.api'
import { QuickUploadGrid } from './DocumentUploadZone'
import { DocumentList } from './DocumentList'
import { DocumentPreviewModal } from './DocumentPreviewModal'

interface StaffDocumentsTabProps {
  userId: string
}

export function StaffDocumentsTab({ userId }: StaffDocumentsTabProps) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingTypes, setUploadingTypes] = useState<Set<DocumentType>>(new Set())
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null)

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const data = await staffApi.getDocuments(userId)
      setDocuments(data)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách tài liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDocuments()
  }, [userId])

  const handleUpload = async (file: File, type: DocumentType) => {
    // Validate file size (10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      alert('File quá lớn. Tối đa 10MB.')
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      alert('Loại file không được hỗ trợ. Chỉ chấp nhận ảnh (JPEG, PNG, WebP) và PDF.')
      return
    }

    setUploadingTypes((prev) => new Set(prev).add(type))

    try {
      const uploadData: UploadDocumentDto = { type }
      await staffApi.uploadDocument(userId, file, uploadData)
      await loadDocuments()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Tải lên thất bại')
    } finally {
      setUploadingTypes((prev) => {
        const next = new Set(prev)
        next.delete(type)
        return next
      })
    }
  }

  const handleDelete = async (docId: string) => {
    try {
      await staffApi.deleteDocument(userId, docId)
      await loadDocuments()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Xóa thất bại')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-foreground-muted">
          <Loader2 size={20} className="animate-spin text-primary-500" />
          Đang tải tài liệu...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-foreground-muted">
        <AlertCircle size={32} className="text-error" />
        <p>{error}</p>
        <button
          onClick={() => void loadDocuments()}
          className="btn-outline rounded-lg px-4 py-2 text-sm"
        >
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Upload Section */}
      <QuickUploadGrid onUpload={handleUpload} uploadingTypes={uploadingTypes} />

      {/* Document List */}
      <DocumentList
        documents={documents}
        onDelete={handleDelete}
        onView={(doc) => setPreviewDoc(doc)}
      />

      {/* Preview Modal */}
      {previewDoc && <DocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}
