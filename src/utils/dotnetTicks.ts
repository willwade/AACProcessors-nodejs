export const DOTNET_EPOCH_TICKS = 621355968000000000n;
export const TICKS_PER_MILLISECOND = 10000n;

export function dotNetTicksToDate(ticks: number | bigint): Date {
  const tickValue = BigInt(ticks);
  const ms = Number((tickValue - DOTNET_EPOCH_TICKS) / TICKS_PER_MILLISECOND);
  return new Date(ms);
}
