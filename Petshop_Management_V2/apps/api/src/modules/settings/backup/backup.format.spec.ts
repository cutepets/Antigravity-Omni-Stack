import { decodeBackupArchive, encodeBackupArchive } from './backup.format'

describe('backup.format', () => {
  it('encodes and decodes a valid .appbak payload with the correct password', () => {
    const payload = {
      manifest: {
        appId: 'application',
        appVersion: '1.0.0',
        formatName: 'App Backup Format',
        formatVersion: 1,
        createdAt: '2026-04-21T00:00:00.000Z',
        createdBy: 'user-1',
        schemaFingerprint: 'schema-1',
        selectedModules: ['core.settings'],
        excludedBinaryContent: true as const,
        keepsFileRefs: true as const,
        containsSecrets: false,
        modules: [],
      },
      modules: {},
    }

    const archive = encodeBackupArchive(payload, 'backup-password')
    const decoded = decodeBackupArchive(archive, 'backup-password')

    expect(decoded).toEqual(payload)
  })

  it('rejects decoding when the password is wrong', () => {
    const archive = encodeBackupArchive(
      {
        manifest: {
          appId: 'application',
          appVersion: '1.0.0',
          formatName: 'App Backup Format',
          formatVersion: 1,
          createdAt: '2026-04-21T00:00:00.000Z',
          createdBy: null,
          schemaFingerprint: 'schema-1',
          selectedModules: ['core.settings'],
          excludedBinaryContent: true as const,
          keepsFileRefs: true as const,
          containsSecrets: false,
          modules: [],
        },
        modules: {},
      },
      'correct-password',
    )

    expect(() => decodeBackupArchive(archive, 'wrong-password')).toThrow(
      'Khong giai ma duoc file backup. Kiem tra lai mat khau',
    )
  })
})

