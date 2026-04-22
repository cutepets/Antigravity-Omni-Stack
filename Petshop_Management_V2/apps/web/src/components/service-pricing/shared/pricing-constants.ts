import type { DayTypeOption } from './pricing-types'

export const SPECIES_OPTIONS = [
  { value: 'Chó', label: 'Chó' },
  { value: 'Mèo', label: 'Mèo' },
]

export const SPA_PACKAGES = [
  { code: 'BATH', label: 'Tắm' },
  { code: 'BATH_CLEAN', label: 'Tắm + Vệ sinh' },
  { code: 'SHAVE', label: 'Cạo' },
  { code: 'BATH_SHAVE_CLEAN', label: 'Tắm + Cạo + VS' },
  { code: 'SPA', label: 'SPA' },
]

export const DAY_TYPE_OPTIONS: DayTypeOption[] = [
  { value: 'REGULAR', label: 'Ngày thường', hint: 'Dùng cho các ngày không nằm trong lịch lễ' },
  { value: 'HOLIDAY', label: 'Ngày lễ', hint: 'Dùng khi ngày gửi nằm trong lịch ngày lễ active' },
]

export const HOTEL_SPECIES_COLUMNS = SPECIES_OPTIONS
