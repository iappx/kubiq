import { describe, expect, it } from 'vitest'
import { UiTableValue } from '@/components/common/table/UiTableValue'

describe('UiTableValue', () => {
    it('reads a plain property and a getter alike', () => {
        class Row {
            public name = 'api'

            get ready(): string {
                return '1/1'
            }
        }

        expect(UiTableValue.read(new Row(), 'name')).toBe('api')
        expect(UiTableValue.read(new Row(), 'ready')).toBe('1/1')
    })

    it('reads nothing out of a value that is not an object', () => {
        expect(UiTableValue.read(null, 'name')).toBeUndefined()
        expect(UiTableValue.read('api', 'name')).toBeUndefined()
    })

    it('renders an absent value as an empty cell rather than the word undefined', () => {
        expect(UiTableValue.text(undefined)).toBe('')
        expect(UiTableValue.text(null)).toBe('')
    })

    it('renders numbers, booleans and lists as text', () => {
        expect(UiTableValue.text(0)).toBe('0')
        expect(UiTableValue.text(false)).toBe('false')
        expect(UiTableValue.text(['80/TCP', '443/TCP'])).toBe('80/TCP, 443/TCP')
    })

    it('leaves a structure it cannot flatten to the cell slot', () => {
        expect(UiTableValue.text({ ports: 2 })).toBe('')
    })
})
