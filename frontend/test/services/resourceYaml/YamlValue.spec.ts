import { describe, expect, it } from 'vitest'
import { YamlValue } from '@/application/services/resourceYaml/models/YamlValue'

describe('YamlValue.equal', () => {
    it('treats two mappings with the same pairs in another order as equal', () => {
        expect(YamlValue.equal({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })

    it('sees a missing key', () => {
        expect(YamlValue.equal({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    })

    it('compares arrays by position', () => {
        expect(YamlValue.equal([1, 2], [2, 1])).toBe(false)
        expect(YamlValue.equal([1, 2], [1, 2])).toBe(true)
    })

    it('goes all the way down', () => {
        expect(YamlValue.equal({ spec: { template: { x: [1, { y: 'z' }] } } }, { spec: { template: { x: [1, { y: 'z' }] } } })).toBe(true)
        expect(YamlValue.equal({ spec: { template: { x: [1, { y: 'z' }] } } }, { spec: { template: { x: [1, { y: 'w' }] } } })).toBe(false)
    })

    it('does not confuse an absent value with a null one', () => {
        expect(YamlValue.equal({ a: null }, {})).toBe(false)
    })

    it('does not treat an array as a mapping', () => {
        expect(YamlValue.equal([], {})).toBe(false)
    })
})
