import {
  Cr922_managedappinventoriescr922_coredatasource as CoreDataSourceMap,
  Cr922_managedappinventoriescr922_status as StatusMap,
} from '../../generated/models/Cr922_managedappinventoriesModel'

export type CoreDataSourceValue = keyof typeof CoreDataSourceMap
export type StatusValue = keyof typeof StatusMap

type Option<T> = { value: T; label: string }

function toOptions<T extends Record<number, string>>(
  map: T
): Option<keyof T & number>[] {
  return Object.entries(map).map(([value, label]) => ({
    value: Number(value) as keyof T & number,
    label: label as string,
  }))
}

export const DATA_SOURCE_OPTIONS = toOptions(CoreDataSourceMap)
export const STATUS_OPTIONS = toOptions(StatusMap)

export function dataSourceLabel(value?: CoreDataSourceValue): string {
  return value === undefined ? 'Unspecified' : CoreDataSourceMap[value]
}

export function statusLabel(value?: StatusValue): string {
  return value === undefined ? 'Unspecified' : StatusMap[value]
}

/** Drives the per-status accent colour in the card list. */
export const STATUS_TONE: Record<StatusValue, string> = {
  100000000: 'draft',
  100000001: 'local',
  100000002: 'deployed',
}
