import { describe, expect, it } from 'vitest'
import { UiTableCursor } from '@/components/common/table/UiTableCursor'

const keys = ['a', 'b', 'c']

describe('UiTableCursor', () => {
    it('moves down and up one row at a time', () => {
        expect(UiTableCursor.move(keys, 'a', 1)).toBe('b')
        expect(UiTableCursor.move(keys, 'b', -1)).toBe('a')
    })

    it('stops at the ends instead of wrapping around', () => {
        expect(UiTableCursor.move(keys, 'c', 1)).toBe('c')
        expect(UiTableCursor.move(keys, 'a', -1)).toBe('a')
    })

    it('enters the list from the matching end when there is no cursor yet', () => {
        expect(UiTableCursor.move(keys, null, 1)).toBe('a')
        expect(UiTableCursor.move(keys, null, -1)).toBe('c')
    })

    it('re-enters the list when the cursor row has gone', () => {
        expect(UiTableCursor.move(keys, 'deleted', 1)).toBe('a')
    })

    it('has nowhere to go in an empty list', () => {
        expect(UiTableCursor.move([], 'a', 1)).toBeNull()
        expect(UiTableCursor.first([])).toBeNull()
        expect(UiTableCursor.last([])).toBeNull()
    })

    it('jumps to the first and last rows', () => {
        expect(UiTableCursor.first(keys)).toBe('a')
        expect(UiTableCursor.last(keys)).toBe('c')
    })

    it('drops a cursor that the current rows no longer contain', () => {
        expect(UiTableCursor.keep(keys, 'b')).toBe('b')
        expect(UiTableCursor.keep(keys, 'deleted')).toBeNull()
    })
})
