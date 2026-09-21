import { describe, expect, it } from 'vitest'
import { UiTableSelection } from '@/components/common/table/UiTableSelection'

const keys = ['a', 'b', 'c', 'd', 'e']

describe('UiTableSelection', () => {
    it('adds and removes a single key', () => {
        expect(UiTableSelection.toggle([], 'b')).toEqual(['b'])
        expect(UiTableSelection.toggle(['a', 'b'], 'b')).toEqual(['a'])
    })

    it('extends a range forwards and backwards from the anchor', () => {
        expect(UiTableSelection.range(['b'], keys, 'b', 'd')).toEqual(['b', 'c', 'd'])
        expect(UiTableSelection.range(['d'], keys, 'd', 'b')).toEqual(['d', 'b', 'c'])
    })

    it('adds nothing twice when a range overlaps the current selection', () => {
        expect(UiTableSelection.range(['c'], keys, 'b', 'd')).toEqual(['c', 'b', 'd'])
    })

    it('falls back to a plain toggle when the anchor is no longer on the page', () => {
        expect(UiTableSelection.range([], keys, 'gone', 'c')).toEqual(['c'])
    })

    it('selects the whole loaded page and clears it again', () => {
        const all = UiTableSelection.togglePage(['x'], keys)

        expect(all).toEqual(['x', ...keys])
        expect(UiTableSelection.togglePage(all, keys)).toEqual(['x'])
    })

    it('reports a partial page only while some rows are unselected', () => {
        expect(UiTableSelection.isPagePartial(['a'], keys)).toBe(true)
        expect(UiTableSelection.isPagePartial(keys, keys)).toBe(false)
        expect(UiTableSelection.isPagePartial([], keys)).toBe(false)
    })

    it('does not call an empty page fully selected', () => {
        expect(UiTableSelection.isPageSelected([], [])).toBe(false)
    })
})
