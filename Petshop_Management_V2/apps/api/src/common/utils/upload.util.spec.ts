import { BadRequestException } from '@nestjs/common'
import { resolveUploadedFilePath } from './upload.util'

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
})
