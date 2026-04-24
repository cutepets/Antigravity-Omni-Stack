import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveCartServiceImage } from './service-image.utils'

test('resolves spa service image by pricing snapshot package code when the cart item has no image', () => {
  const imageMap = new Map([
    ['BATH', '/uploads/spa/bath.jpg'],
  ])

  const image = resolveCartServiceImage(
    {
      type: 'grooming',
      description: 'Chi tam',
      groomingDetails: {
        pricingSnapshot: {
          packageCode: 'BATH',
        },
      },
    },
    imageMap,
  )

  assert.equal(image, '/uploads/spa/bath.jpg')
})

test('keeps the direct cart item image before using service lookup images', () => {
  const imageMap = new Map([
    ['BATH', '/uploads/spa/bath.jpg'],
  ])

  const image = resolveCartServiceImage(
    {
      type: 'grooming',
      description: 'Chi tam',
      image: '/custom/direct.jpg',
      groomingDetails: {
        pricingSnapshot: {
          packageCode: 'BATH',
        },
      },
    },
    imageMap,
  )

  assert.equal(image, '/custom/direct.jpg')
})

test('resolves suggested hotel service image by label when configured in the service image map', () => {
  const imageMap = new Map([
    ['hotel luu tru', '/uploads/spa/hotel.jpg'],
  ])

  const image = resolveCartServiceImage(
    {
      type: 'hotel',
      suggestionKind: 'HOTEL',
      name: 'Hotel luu tru',
      description: 'Hotel luu tru',
    },
    imageMap,
  )

  assert.equal(image, '/uploads/spa/hotel.jpg')
})
