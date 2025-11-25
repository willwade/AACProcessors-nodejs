/**
 * Number of ticks (.NET 100ns units) between 0001-01-01 and Unix epoch.
 */
export const DOTNET_EPOCH_TICKS = 621355968000000000n;

/**
 * Number of ticks per millisecond.
 */
export const TICKS_PER_MILLISECOND = 10000n;

/**
 * Convert .NET ticks (100ns since 0001-01-01) to a JavaScript Date.
 * Accepts bigint or number and rounds down to millisecond precision.
 */
export function dotNetTicksToDate(ticks: number | bigint): Date {
  const tickValue = BigInt(ticks);
  const ms = Number((tickValue - DOTNET_EPOCH_TICKS) / TICKS_PER_MILLISECOND);
  return new Date(ms);
}
