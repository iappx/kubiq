import { describe, expect, it } from 'vitest'
import { HelmOutputBuffer } from '@/application/services/helm/models/HelmOutputBuffer'

describe('HelmOutputBuffer', () => {
    it('splits what helm wrote into lines', () => {
        const buffer = new HelmOutputBuffer()

        buffer.append('NAME: web\nLAST DEPLOYED: today\n')

        expect(buffer.lines).toEqual(['NAME: web', 'LAST DEPLOYED: today'])
    })

    it('shows a line helm has not finished writing yet', () => {
        const buffer = new HelmOutputBuffer()

        buffer.append('NAME: ')

        expect(buffer.lines).toEqual(['NAME: '])
    })

    it('joins a line that arrived in two chunks', () => {
        const buffer = new HelmOutputBuffer()

        buffer.append('STATUS: dep')
        buffer.append('loyed\n')

        expect(buffer.lines).toEqual(['STATUS: deployed'])
    })

    it('reads a windows line ending as one line break, not two', () => {
        const buffer = new HelmOutputBuffer()

        buffer.append('one\r\ntwo\r\n')

        expect(buffer.lines).toEqual(['one', 'two'])
    })

    it('keeps the newest lines and counts what it dropped', () => {
        const buffer = new HelmOutputBuffer(3)

        buffer.append('1\n2\n3\n4\n5\n')

        expect(buffer.lines).toEqual(['3', '4', '5'])
        expect(buffer.lost).toBe(2)
    })

    it('keeps the last line when the process ends without a newline', () => {
        const buffer = new HelmOutputBuffer()

        buffer.append('no trailing newline')
        buffer.flush()

        expect(buffer.count).toBe(1)
        expect(buffer.text()).toBe('no trailing newline')
    })
})
