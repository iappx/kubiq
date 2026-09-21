import type { Component as VueComponent } from 'vue'

export type TUiMenuItem = {
    key: string
    label: string
    icon?: VueComponent
    danger?: boolean
    separatorBefore?: boolean
}
