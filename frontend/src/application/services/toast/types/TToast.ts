import type { TToastAction } from '@/application/services/toast/types/TToastAction'

export type TToast = {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  description?: string
  count?: number
  action?: TToastAction
}
