import type { TUiSelectOption } from '@/components/common/select/types/TUiSelectOption'

export class UiSelectOptions {
    // A selected value with no item of its own can never be toggled off again: the select only
    // changes the model through an item click, so what the options lost stays in the model for good.
    public static withSelected(options: readonly TUiSelectOption[], selected: readonly string[]): TUiSelectOption[] {
        const known = options.map(option => option.key)
        const missing = [...new Set(selected)].filter(key => !known.includes(key))

        return [...options, ...missing.map(key => ({ key, title: key }))]
    }
}
