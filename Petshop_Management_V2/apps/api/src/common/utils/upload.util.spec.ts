import { BadRequestException } from '@nestjs/common'
import { resolveUploadedFilePath, validateUploadedFile } from './upload.util'

describe('upload.util', () => {
  it('resolves a valid uploaded file path inside the configured root', () => {
    const result = resolveUploadedFilePath('/uploads/files/test.pdf', {
      publicPrefix: '/uploads/files/',
      rootDir: 'uploads/files',
    })

    expect(result.relativePath).toBe('test.pdf')
    expect(result.absolutePath).toContain('uploads')
  })

  it('rejects path traversal attempts', () => {
    expect(() =>
      resolveUploadedFilePath('/uploads/files/../secret.txt', {
        publicPrefix: '/uploads/files/',
        rootDir: 'uploads/files',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects mismatched upload prefixes', () => {
    expect(() =>
      resolveUploadedFilePath('/uploads/images/test.png', {
        publicPrefix: '/uploads/files/',
        rootDir: 'uploads/files',
      }),
    ).toThrow(BadRequestException)
  })

  it('validates uploaded file size and type', () => {
    const options = {
      allowedMimeTypes: new Set(['application/pdf']),
      allowedExtensions: new Set(['.pdf']),
      maxFileSize: 1024,
      errorMessage: 'Invalid file',
    }

    expect(() =>
      validateUploadedFile(
        {
          originalname: 'contract.exe',
          mimetype: 'application/octet-stream',
          size: 10,
          filename: 'contract.exe',
        } as Express.Multer.File,
        options,
      ),
    ).toThrow(BadRequestException)

    expect(() =>
      validateUploadedFile(
        {
          originalname: 'contract.pdf',
          mimetype: 'application/pdf',
          size: 2048,
          filename: 'contract.pdf',
        } as Express.Multer.File,
        options,
      ),
    ).toThrow(BadRequestException)

    expect(() =>
      validateUploadedFile(
        {
          originalname: 'contract.pdf',
          mimetype: 'application/pdf',
          size: 512,
          filename: 'contract.pdf',
        } as Express.Multer.File,
        options,
      ),
    ).not.toThrow()
  })
})
