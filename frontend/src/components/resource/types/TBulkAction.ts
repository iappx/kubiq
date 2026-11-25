import type { Component as VueComponent } from 'vue'

export type TBulkAction = {
    key: string
    label: string
    icon: VueComponent
    danger?: boolean
}
