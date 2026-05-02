import assert from 'node:assert/strict'
import { test } from 'node:test'

// @ts-ignore Node ESM test runner needs the explicit .ts extension here.
import { buildSpaServiceImageMap, getGroomingColumnAvatarKey, getSpaServiceImageLookupKey, resolveSpaServiceImage } from './spa-service-image.utils.ts'

test('resolves grooming service images by exact species before shared fallback', () => {
  const imageMap = buildSpaServiceImageMap([
    { species: 'Chó', packageCode: 'Tắm', imageUrl: '/uploads/dog-bath.jpg' },
    { species: 'Mèo', packageCode: 'Tắm', imageUrl: '/uploads/cat-bath.jpg' },
    { species: null, packageCode: 'Vệ sinh tai', imageUrl: '/uploads/ear-clean.jpg' },
  ])

  assert.equal(resolveSpaServiceImage(imageMap, 'Chó', 'Tắm'), '/uploads/dog-bath.jpg')
  assert.equal(resolveSpaServiceImage(imageMap, 'Mèo', 'Tắm'), '/uploads/cat-bath.jpg')
  assert.equal(resolveSpaServiceImage(imageMap, 'Chó', 'Vệ sinh tai'), '/uploads/ear-clean.jpg')
})

test('creates distinct grooming avatar cache keys for dog and cat tabs', () => {
  assert.equal(getGroomingColumnAvatarKey('Chó', 'bath'), 'cho:bath')
  assert.equal(getGroomingColumnAvatarKey('Mèo', 'bath'), 'meo:bath')
  assert.notEqual(getGroomingColumnAvatarKey('Chó', 'bath'), getGroomingColumnAvatarKey('Mèo', 'bath'))
  assert.equal(getSpaServiceImageLookupKey('Chó', 'Tắm'), 'cho:tam')
})
