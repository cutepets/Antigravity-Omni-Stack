import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatAboutDate,
  getCurrentAboutVersion,
  getRecentChangelog,
  type ChangeLogEntry,
} from './tab-about.utils'

const changelog: ChangeLogEntry[] = [
  { version: '1.00', date: '2026-05-01', changes: ['Current release'] },
  { version: '0.99', date: '2026-04-26', changes: ['Previous release'] },
]

test('keeps the about version on the changelog sequence instead of package metadata', () => {
  assert.equal(getCurrentAboutVersion(changelog, '2.5.1'), '1.00')
  assert.deepEqual(
    getRecentChangelog(changelog, '2.5.1').map((entry) => entry.version),
    ['1.00', '0.99'],
  )
})

test('formats ISO build dates for Vietnamese display', () => {
  assert.equal(formatAboutDate('2026-05-01T16:15:57Z'), '01/05/2026, 23:15')
  assert.equal(formatAboutDate('2026-05-01'), '01/05/2026')
  assert.equal(formatAboutDate(null), '--')
})
