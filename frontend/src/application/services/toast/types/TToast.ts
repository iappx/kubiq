export type TToast = {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  description?: string
}
