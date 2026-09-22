import Cr922_managedappinventoriesService from '../../generated/services/Cr922_managedappinventoriesService'
import type {
  Cr922_managedappinventories,
  Cr922_managedappinventoriesBase,
} from '../../generated/models/Cr922_managedappinventoriesModel'

export type InventoryRecord = Cr922_managedappinventories
export type InventoryDraft = Omit<
  Cr922_managedappinventoriesBase,
  'cr922_managedappinventoryid' | 'statecode'
>

const SELECT = [
  'cr922_managedappinventoryid',
  'cr922_appname',
  'cr922_description',
  'cr922_valueprovided',
  'cr922_shared',
  'cr922_sharedwith',
  'cr922_coredatasource',
  'cr922_status',
  'cr922_appguid',
  'cr922_environment',
  'cr922_notes',
  'createdon',
].join(',')

function unwrap<T>(result: {
  success: boolean
  data?: T
  error?: { message?: string }
}): T | undefined {
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Dataverse operation failed')
  }
  return result.data
}

export async function listApps(): Promise<InventoryRecord[]> {
  const result = await Cr922_managedappinventoriesService.ListRecords({
    $select: SELECT,
    $orderby: 'createdon desc',
  })
  const data = unwrap(result) as
    | { value?: InventoryRecord[] }
    | InventoryRecord[]
    | undefined

  if (Array.isArray(data)) return data
  return data?.value ?? []
}

export async function createApp(draft: InventoryDraft): Promise<void> {
  unwrap(
    await Cr922_managedappinventoriesService.CreateRecord(
      draft as Omit<Cr922_managedappinventoriesBase, 'cr922_managedappinventoryid'>
    )
  )
}

export async function updateApp(
  recordId: string,
  draft: InventoryDraft
): Promise<void> {
  unwrap(await Cr922_managedappinventoriesService.UpdateRecord(recordId, draft))
}

export async function deleteApp(recordId: string): Promise<void> {
  unwrap(await Cr922_managedappinventoriesService.DeleteRecord(recordId))
}
