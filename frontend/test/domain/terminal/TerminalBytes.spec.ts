import { describe, expect, it } from 'vitest'
import { TerminalBytes } from '@/domain/models/terminal'

describe('TerminalBytes', () => {
    it('survives a round trip through base64', () => {
        const source = TerminalBytes.fromText('echo "héllo ✓"\r\n')

        expect([...TerminalBytes.decode(TerminalBytes.encode(source))]).toEqual([...source])
    })

    it('reads an empty payload as no bytes', () => {
        expect(TerminalBytes.decode('').length).toBe(0)
    })

    // A chunk boundary inside a UTF-8 sequence is the normal case on a busy stream:
    // the bytes have to survive it, because only the terminal can decode them.
    it('keeps a multi-byte character split across two chunks intact', () => {
        const whole = TerminalBytes.fromText('✓')
        const head = TerminalBytes.encode(whole.slice(0, 1))
        const tail = TerminalBytes.encode(whole.slice(1))

        const joined = TerminalBytes.concat([TerminalBytes.decode(head), TerminalBytes.decode(tail)])

        expect(new TextDecoder().decode(joined)).toBe('✓')
    })

    it('concatenates chunks in order', () => {
        const joined = TerminalBytes.concat([
            TerminalBytes.fromText('one '),
            TerminalBytes.fromText('two'),
        ])

        expect(new TextDecoder().decode(joined)).toBe('one two')
    })

    it('handles bytes that are not valid text at all', () => {
        const raw = new Uint8Array([0x00, 0x1b, 0x5b, 0x41, 0xff])

        expect([...TerminalBytes.decode(TerminalBytes.encode(raw))]).toEqual([...raw])
    })
})
