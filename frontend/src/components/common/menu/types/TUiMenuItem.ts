import type { Component as VueComponent } from 'vue'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

export type TUiMenuItem = {
    key: string
    label: string
    icon?: VueComponent
    tone?: TUiTone
    hint?: string
    danger?: boolean
    separatorBefore?: boolean
}
