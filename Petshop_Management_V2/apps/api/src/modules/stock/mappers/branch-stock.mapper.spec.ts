import { aggregateBranchStocks, scaleBranchStocks } from './branch-stock.mapper'

describe('branch stock mapper', () => {
  it('aggregates stock rows by branch identity', () => {
    expect(
      aggregateBranchStocks([
        { id: 'row-1', branchId: 'branch-1', stock: 3, reservedStock: 1, minStock: 2 },
        { id: 'row-2', branchId: 'branch-1', stock: '4', reservedStock: '2', minStock: '1' },
        { id: 'row-3', branch: { id: 'branch-2' }, stock: 5, reservedStock: 0, minStock: 3 },
      ]),
    ).toEqual([
      { id: 'row-1', branchId: 'branch-1', stock: 7, reservedStock: 3, minStock: 3 },
      { id: 'row-3', branch: { id: 'branch-2' }, stock: 5, reservedStock: 0, minStock: 3 },
    ])
  })

  it('scales stock rows for conversion variants and can preserve min stock', () => {
    expect(
      scaleBranchStocks(
        [{ id: 'row-1', branchId: 'branch-1', stock: 12, reservedStock: 4, minStock: 2 }],
        0.5,
        { resetMinStock: false },
      ),
    ).toEqual([{ id: 'row-1', branchId: 'branch-1', stock: 6, reservedStock: 2, minStock: 1 }])

    expect(scaleBranchStocks([{ stock: 12, reservedStock: 4, minStock: 2 }], 0.5)).toEqual([
      { stock: 6, reservedStock: 2, minStock: 0 },
    ])
  })
})
