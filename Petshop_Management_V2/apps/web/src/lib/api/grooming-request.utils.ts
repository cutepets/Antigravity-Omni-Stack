import type { GetGroomingSessionsParams } from './grooming.api'

export function buildGroomingSessionsRequestConfig(params?: GetGroomingSessionsParams) {
  const { omitBranchId, ...restParams } = params || {}
  return {
    params: restParams,
    ...(omitBranchId ? {} : { headers: { 'X-Use-Branch-Scope': 'true' } }),
  }
}
