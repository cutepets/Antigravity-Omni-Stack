import { formatSequentialCode } from '@petshop/shared'

type RawSqlClient = {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>
}

type SequentialCodeOptions = {
  table: string
  column: string
  prefix: string
  padLength?: number
}

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const PREFIX_RE = /^[A-Z]+$/

const assertSafeIdentifier = (value: string, label: string): void => {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid ${label} "${value}" for sequential code query`)
  }
}

const assertSafePrefix = (value: string): void => {
  if (!PREFIX_RE.test(value)) {
    throw new Error(`Invalid sequential code prefix "${value}"`)
  }
}

export async function getNextSequentialCode(
  db: RawSqlClient,
  options: SequentialCodeOptions,
): Promise<string> {
  const { table, column, prefix, padLength = 6 } = options

  assertSafeIdentifier(table, 'table')
  assertSafeIdentifier(column, 'column')
  assertSafePrefix(prefix)

  const [result] = await db.$queryRawUnsafe<Array<{ maxNumber: number | bigint | null }>>(`
    SELECT MAX(CAST(SUBSTRING("${column}" FROM '([0-9]+)$') AS INTEGER)) AS "maxNumber"
    FROM "${table}"
    WHERE "${column}" ~ '^${prefix}[0-9]+$'
  `)

  const lastNumber = Number(result?.maxNumber ?? 0)
  return formatSequentialCode(prefix, lastNumber + 1, padLength)
}
