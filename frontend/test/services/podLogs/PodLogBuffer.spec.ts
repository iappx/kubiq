import { beforeEach, describe, expect, it } from 'vitest'
import { PodLogBuffer } from '@/application/services/podLogs/models/PodLogBuffer'

let buffer: PodLogBuffer

describe('PodLogBuffer', () => {
    beforeEach(() => {
        buffer = new PodLogBuffer()
    })

    it('keeps only whole lines and holds the rest back', () => {
        expect(buffer.append('first\nsecond\nthi')).toBe(2)

        expect([...buffer.lines]).toEqual(['first', 'second'])
    })

    it('reassembles a line split across chunk boundaries', () => {
        buffer.append('level=info msg="star')
        buffer.append('ted" took=3ms\n')

        expect([...buffer.lines]).toEqual(['level=info msg="started" took=3ms'])
    })

    it('reassembles a line split across many chunks', () => {
        'abcdefghij'.split('').forEach(letter => buffer.append(letter))
        buffer.append('\n')

        expect([...buffer.lines]).toEqual(['abcdefghij'])
    })

    it('strips the carriage return of CRLF output', () => {
        buffer.append('windows\r\nunix\n')

        expect([...buffer.lines]).toEqual(['windows', 'unix'])
    })

    it('keeps an empty line rather than swallowing it', () => {
        buffer.append('one\n\ntwo\n')

        expect([...buffer.lines]).toEqual(['one', '', 'two'])
    })

    it('ignores an empty chunk', () => {
        expect(buffer.append('')).toBe(0)
        expect(buffer.revision).toBe(0)
    })

    it('drops the oldest lines at the cap and keeps the rest in order', () => {
        const capped = new PodLogBuffer(3)

        capped.append('1\n2\n3\n4\n5\n')

        expect([...capped.lines]).toEqual(['3', '4', '5'])
        expect(capped.dropped).toBe(2)
        expect(capped.size).toBe(3)
    })

    it('drops the oldest lines when the character cap is reached first', () => {
        const capped = new PodLogBuffer(1000, 12)

        capped.append('aaaa\nbbbb\ncccc\n')

        expect([...capped.lines]).toEqual(['bbbb', 'cccc'])
        expect(capped.dropped).toBe(1)
    })

    it('counts every drop across several appends', () => {
        const capped = new PodLogBuffer(2)

        capped.append('1\n2\n3\n')
        capped.append('4\n')

        expect([...capped.lines]).toEqual(['3', '4'])
        expect(capped.dropped).toBe(2)
    })

    it('bumps its revision only when lines actually changed', () => {
        buffer.append('half')
        expect(buffer.revision).toBe(0)

        buffer.append(' a line\n')
        expect(buffer.revision).toBe(1)
    })

    it('promotes a trailing partial line when the stream ends', () => {
        buffer.append('done\nhalf written')
        buffer.flush()

        expect([...buffer.lines]).toEqual(['done', 'half written'])
    })

    it('has nothing to flush when the last chunk ended on a newline', () => {
        buffer.append('done\n')
        const revision = buffer.revision

        buffer.flush()

        expect([...buffer.lines]).toEqual(['done'])
        expect(buffer.revision).toBe(revision)
    })

    it('renders its text with the unfinished line included', () => {
        buffer.append('one\ntwo\nthr')

        expect(buffer.text()).toBe('one\ntwo\nthr')
    })

    it('forgets everything when cleared', () => {
        buffer.append('one\ntwo\n')
        buffer.clear()

        expect(buffer.size).toBe(0)
        expect(buffer.dropped).toBe(0)
        expect(buffer.text()).toBe('')
    })
})
