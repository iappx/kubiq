import type { TFileDialogFilter } from '@/infrastructure/wails/types/TFileDialogFilter'

export type TOpenFileRequest = {
    title: string
    filters?: readonly TFileDialogFilter[]
}
