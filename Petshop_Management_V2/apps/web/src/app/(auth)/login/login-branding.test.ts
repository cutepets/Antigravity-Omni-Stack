import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeLoginBranding } from './login-branding'

test('normalizes configured shop name and logo for login branding', () => {
  assert.deepEqual(
    normalizeLoginBranding({
      success: true,
      data: {
        shopName: '  Cutepets Hanoi  ',
        shopLogo: '  https://cdn.example/logo.png  ',
      },
    }),
    {
      shopName: 'Cutepets Hanoi',
      shopLogo: 'https://cdn.example/logo.png',
    },
  )
})

test('falls back when public branding is blank or missing', () => {
  assert.deepEqual(
    normalizeLoginBranding({
      data: {
        shopName: '   ',
        shopLogo: '',
      },
    }),
    {
      shopName: 'PetShop',
      shopLogo: null,
    },
  )

  assert.deepEqual(normalizeLoginBranding(null), {
    shopName: 'PetShop',
    shopLogo: null,
  })
})
