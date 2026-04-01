---
name: tanstack-query-patterns
description: >
  TanStack Query (React Query) patterns for SPA — queryKey conventions,
  mutations, optimistic updates, cache invalidation, pagination, prefetching.
  For Vite + React + TypeScript projects.
---

# ⚡ TanStack Query Patterns

You are a **React Data Layer Expert**. You build fast, consistent, and resilient server-state management using TanStack Query.

---

## 📑 Internal Menu
1. [Setup & Configuration](#1-setup--configuration)
2. [QueryKey Conventions](#2-querykey-conventions)
3. [Query Patterns](#3-query-patterns)
4. [Mutation Patterns](#4-mutation-patterns)
5. [Cache Invalidation Strategy](#5-cache-invalidation-strategy)
6. [Optimistic Updates](#6-optimistic-updates)
7. [Pagination & Infinite Scroll](#7-pagination--infinite-scroll)
8. [Prefetching & Background Refresh](#8-prefetching--background-refresh)
9. [Error & Loading Handling](#9-error--loading-handling)

---

## 1. Setup & Configuration

```typescript
// main.tsx or App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes — data stays fresh
      gcTime: 1000 * 60 * 10,      // 10 minutes — cache retention
      retry: 1,                     // retry once on failure
      refetchOnWindowFocus: false,  // prevent unnecessary refetches
    },
    mutations: {
      retry: 0,                     // never retry mutations
    }
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* your app */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

---

## 2. QueryKey Conventions

**QueryKeys should be structured, deterministic arrays:**

```typescript
// ✅ Structure: [entity, scope?, filters?]
['orders']                                    // all orders
['orders', 'list', { status: 'PENDING' }]    // filtered list
['orders', 'detail', orderId]                 // single item
['orders', 'stats', { branchId }]            // aggregate

['products']
['products', 'list', { page: 1, category: 'food' }]
['products', 'detail', productId]

['customers', 'list']
['customers', 'detail', customerId]
['customers', 'detail', customerId, 'pets']  // nested
```

**Create queryKey factories to avoid typos:**
```typescript
// api/queryKeys.ts
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
}

// Usage:
queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
useQuery({ queryKey: orderKeys.detail(id), ... })
```

---

## 3. Query Patterns

### Basic query hook
```typescript
// hooks/useOrders.ts
export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => api.get('/orders', { params: filters }),
    staleTime: 1000 * 30,  // 30s for frequently changing data
  })
}

// In component:
const { data, isLoading, error } = useOrders({ status: 'PENDING' })
```

### Single item query
```typescript
export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api.get(`/orders/${id}`),
    enabled: !!id,  // ✅ Don't run if no ID
  })
}
```

### Dependent queries
```typescript
// Query B depends on Query A's result
const { data: customer } = useCustomer(customerId)
const { data: orders } = useOrders({ customerId: customer?.id })  // auto-skips if no customer
```

---

## 4. Mutation Patterns

### Standard mutation with invalidation
```typescript
export function useCreateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: CreateOrderDto) => api.post('/orders', dto),
    onSuccess: () => {
      // Invalidate all order lists
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
    onError: (error) => {
      toast.error(error.message ?? 'Failed to create order')
    },
  })
}

// In component:
const { mutate: createOrder, isPending } = useCreateOrder()
```

### Update mutation (optimistic)
```typescript
export function useUpdateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateOrderDto }) =>
      api.patch(`/orders/${id}`, dto),
    onSuccess: (data, { id }) => {
      // Update cache directly — faster than refetch
      queryClient.setQueryData(orderKeys.detail(id), data)
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}
```

---

## 5. Cache Invalidation Strategy

```typescript
// Invalidation hierarchy — from specific to broad:

// Level 1: Invalidate specific item
queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })

// Level 2: Invalidate all lists (after create/update)
queryClient.invalidateQueries({ queryKey: orderKeys.lists() })

// Level 3: Invalidate everything for entity (after bulk ops)
queryClient.invalidateQueries({ queryKey: orderKeys.all })

// ✅ After creating an order, also invalidate stock/product queries
queryClient.invalidateQueries({ queryKey: productKeys.all })
queryClient.invalidateQueries({ queryKey: stockKeys.all })
```

**Rule:** After any mutation, invalidate the **minimum set** of affected queries.

---

## 6. Optimistic Updates

```typescript
export function useAddToCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: CartItem) => api.post('/cart/items', item),
    
    onMutate: async (newItem) => {
      // 1. Cancel outgoing queries (avoid race conditions)
      await queryClient.cancelQueries({ queryKey: ['cart'] })

      // 2. Snapshot previous value
      const prev = queryClient.getQueryData<CartItem[]>(['cart'])

      // 3. Optimistically update
      queryClient.setQueryData<CartItem[]>(['cart'], (old = []) => [...old, newItem])

      // 4. Return snapshot for rollback
      return { prev }
    },

    onError: (_err, _item, context) => {
      // Rollback on error
      if (context?.prev) {
        queryClient.setQueryData(['cart'], context.prev)
      }
    },

    onSettled: () => {
      // Always refetch for consistency
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
```

---

## 7. Pagination & Infinite Scroll

### Offset pagination
```typescript
export function useOrdersPaginated(filters: OrderFilters) {
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: orderKeys.list({ ...filters, page }),
    queryFn: () => api.get('/orders', { params: { ...filters, page, limit: 20 } }),
    placeholderData: keepPreviousData,  // ✅ keep old data while fetching new page
  })

  return { ...query, page, setPage }
}
```

### Infinite scroll
```typescript
export function useOrdersInfinite(filters: OrderFilters) {
  return useInfiniteQuery({
    queryKey: orderKeys.list({ ...filters, type: 'infinite' }),
    queryFn: ({ pageParam }) =>
      api.get('/orders', { params: { ...filters, cursor: pageParam, limit: 20 } }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
```

---

## 8. Prefetching & Background Refresh

```typescript
// Prefetch on hover (before user clicks)
const queryClient = useQueryClient()

const handleHover = (orderId: string) => {
  queryClient.prefetchQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => api.get(`/orders/${orderId}`),
    staleTime: 1000 * 30,  // don't prefetch if cached < 30s ago
  })
}

// Background refresh for dashboard stats
const { data: stats } = useQuery({
  queryKey: ['dashboard', 'stats'],
  queryFn: fetchStats,
  refetchInterval: 1000 * 60,  // refresh every 1 minute
  refetchIntervalInBackground: false,  // pause when tab inactive
})
```

---

## 9. Error & Loading Handling

```typescript
// Component pattern
function OrderList() {
  const { data, isLoading, error, refetch } = useOrders({ status: 'PENDING' })

  if (isLoading) return <TableSkeleton rows={5} />

  if (error) return (
    <ErrorState
      message={error.message}
      onRetry={() => refetch()}
    />
  )

  if (!data?.length) return <EmptyState message="No orders found" />

  return <OrderTable orders={data} />
}
```

**✅ Always handle all 3 states: loading, error, empty data**

---

## Common Patterns Cheatsheet

| Task | Hook / Method |
|------|--------------|
| Fetch list | `useQuery({ queryKey, queryFn })` |
| Fetch single | `useQuery({ queryKey, queryFn, enabled: !!id })` |
| Create | `useMutation({ mutationFn, onSuccess: invalidate })` |
| Update | `useMutation({ mutationFn, onSuccess: setQueryData })` |
| Optimistic update | `useMutation({ onMutate, onError, onSettled })` |
| Paginated | `useQuery` + `keepPreviousData` |
| Infinite scroll | `useInfiniteQuery` |
| Prefetch on hover | `queryClient.prefetchQuery` |
| Manual update cache | `queryClient.setQueryData` |
| Invalidate | `queryClient.invalidateQueries` |

---

*Stack: TanStack Query v5 · React 18+ · TypeScript · Vite SPA*
