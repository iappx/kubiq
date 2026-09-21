import { describe, expect, it } from 'vitest'
import { TerminalBuffer } from '@/application/services/terminal/models/TerminalBuffer'
import { TerminalBytes } from '@/domain/models/terminal'

const text = (buffer: TerminalBuffer): string => new TextDecoder().decode(buffer.snapshot())

describe('TerminalBuffer', () => {
    it('replays what it was given, in order', () => {
        const buffer = new TerminalBuffer()

        buffer.append(TerminalBytes.fromText('one '))
        buffer.append(TerminalBytes.fromText('two'))

        expect(text(buffer)).toBe('one two')
        expect(buffer.size).toBe(7)
    })

    it('ignores an empty chunk', () => {
        const buffer = new TerminalBuffer()

        buffer.append(new Uint8Array(0))

        expect(buffer.size).toBe(0)
    })

    it('drops the oldest output once it is over its limit', () => {
        const buffer = new TerminalBuffer(8)

        buffer.append(TerminalBytes.fromText('aaaa'))
        buffer.append(TerminalBytes.fromText('bbbb'))
        buffer.append(TerminalBytes.fromText('cccc'))

        expect(text(buffer)).toBe('bbbbcccc')
        expect(buffer.size).toBe(8)
    })

    // A single chunk larger than the whole limit is still the only thing on screen.
    it('keeps the last chunk even when it alone is over the limit', () => {
        const buffer = new TerminalBuffer(4)

        buffer.append(TerminalBytes.fromText('0123456789'))

        expect(text(buffer)).toBe('0123456789')
    })

    it('forgets everything when cleared', () => {
        const buffer = new TerminalBuffer()

        buffer.append(TerminalBytes.fromText('something'))
        buffer.clear()

        expect(buffer.size).toBe(0)
        expect(text(buffer)).toBe('')
    })
})
