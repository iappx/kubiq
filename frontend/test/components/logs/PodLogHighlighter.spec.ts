import { describe, expect, it } from 'vitest'
import { PodLogHighlighter } from '@/components/logs/PodLogHighlighter'

describe('PodLogHighlighter.matches', () => {
    it('matches every line when nothing was typed', () => {
        expect(PodLogHighlighter.matches('anything', '')).toBe(true)
    })

    it('ignores case', () => {
        expect(PodLogHighlighter.matches('Connection REFUSED', 'refused')).toBe(true)
    })

    it('says so when a line does not match', () => {
        expect(PodLogHighlighter.matches('all good', 'refused')).toBe(false)
    })

    it('counts the lines that match', () => {
        const lines = ['error one', 'fine', 'ERROR two']

        expect(PodLogHighlighter.count(lines, 'error')).toBe(2)
        expect(PodLogHighlighter.count(lines, '')).toBe(0)
    })
})

describe('PodLogHighlighter.segments', () => {
    it('returns the whole line as one unmatched piece without a query', () => {
        expect(PodLogHighlighter.segments('level=info', '')).toEqual([{ text: 'level=info', match: false }])
    })

    it('splits around every occurrence', () => {
        expect(PodLogHighlighter.segments('a-x-a', 'a')).toEqual([
            { text: 'a', match: true },
            { text: '-x-', match: false },
            { text: 'a', match: true },
        ])
    })

    it('keeps the original casing of what it matched', () => {
        expect(PodLogHighlighter.segments('ERROR here', 'error')).toEqual([
            { text: 'ERROR', match: true },
            { text: ' here', match: false },
        ])
    })

    it('leaves a line that does not match in one piece', () => {
        expect(PodLogHighlighter.segments('all good', 'error')).toEqual([{ text: 'all good', match: false }])
    })

    it('treats the query as text, not as a pattern', () => {
        expect(PodLogHighlighter.segments('a.b', '.')).toEqual([
            { text: 'a', match: false },
            { text: '.', match: true },
            { text: 'b', match: false },
        ])
    })

    // İ lower-cases to two characters, so an index taken from the shifted string would
    // cut the original line in the wrong place.
    it('never slices a line whose length changes when lower-cased', () => {
        const line = 'İstanbul node ready'

        const rejoined = PodLogHighlighter.segments(line, 'node').map(segment => segment.text).join('')

        expect(rejoined).toBe(line)
    })

    it('always rebuilds the original line from its pieces', () => {
        const line = 'time=2026-09-21T10:00:00Z level=error msg="pod evicted"'

        const rejoined = PodLogHighlighter.segments(line, 'e').map(segment => segment.text).join('')

        expect(rejoined).toBe(line)
    })
})
