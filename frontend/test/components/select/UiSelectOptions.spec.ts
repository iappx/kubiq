import { describe, expect, it } from 'vitest'
import { UiSelectOptions } from '@/components/common/select/UiSelectOptions'

const options = [
    { key: 'default', title: 'default' },
    { key: 'kube-system', title: 'kube-system' },
]

describe('UiSelectOptions', () => {
    it('leaves the offered options alone when every selected key is among them', () => {
        expect(UiSelectOptions.withSelected(options, ['default'])).toEqual(options)
    })

    it('offers a selected key that lost its option, so the choice can be undone', () => {
        expect(UiSelectOptions.withSelected(options, ['default', 'payments'])).toEqual([
            ...options,
            { key: 'payments', title: 'payments' },
        ])
    })

    it('offers a missing key once however often the selection repeats it', () => {
        expect(UiSelectOptions.withSelected(options, ['payments', 'payments'])).toEqual([
            ...options,
            { key: 'payments', title: 'payments' },
        ])
    })

    it('keeps the offered options first and in their own order', () => {
        expect(UiSelectOptions.withSelected(options, ['payments', 'orders']).map(option => option.key))
            .toEqual(['default', 'kube-system', 'payments', 'orders'])
    })

    it('offers nothing of its own for an empty selection', () => {
        expect(UiSelectOptions.withSelected(options, [])).toEqual(options)
    })

    it('carries a selection through while the options are still unknown', () => {
        expect(UiSelectOptions.withSelected([], ['payments'])).toEqual([{ key: 'payments', title: 'payments' }])
    })
})
