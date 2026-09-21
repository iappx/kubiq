import { describe, expect, it } from 'vitest'
import { YamlDiff } from '@/application/services/resourceYaml/models/YamlDiff'

const textOf = (lines: string[]) => lines.join('\n')

describe('YamlDiff', () => {
    it('reports no change for identical documents', () => {
        const lines = YamlDiff.of('a: 1\nb: 2', 'a: 1\nb: 2')

        expect(YamlDiff.hasChanges(lines)).toBe(false)
        expect(lines.every(line => line.kind === 'context')).toBe(true)
    })

    it('marks a changed line as one removal and one addition', () => {
        const lines = YamlDiff.of(textOf(['a: 1', 'b: 2']), textOf(['a: 1', 'b: 3']))

        expect(YamlDiff.summary(lines)).toEqual({ added: 1, removed: 1 })
    })

    it('numbers both sides so each line can be found in its own document', () => {
        const lines = YamlDiff.of(textOf(['a', 'b', 'c']), textOf(['a', 'x', 'b', 'c']))
        const added = lines.find(line => line.kind === 'added')

        expect(added).toMatchObject({ text: 'x', leftNumber: 0, rightNumber: 2 })
    })

    it('finds the lines that survive between two edits rather than replacing the middle', () => {
        const lines = YamlDiff.of(textOf(['a', 'b', 'c', 'd', 'e']), textOf(['a', 'x', 'c', 'y', 'e']))

        expect(YamlDiff.summary(lines)).toEqual({ added: 2, removed: 2 })
        expect(lines.filter(line => line.kind === 'context').map(line => line.text)).toEqual(['a', 'c', 'e'])
    })

    it('reports a pure insertion without claiming anything was removed', () => {
        const lines = YamlDiff.of(textOf(['a', 'b']), textOf(['a', 'new', 'b']))

        expect(YamlDiff.summary(lines)).toEqual({ added: 1, removed: 0 })
    })

    it('reports a pure deletion without claiming anything was added', () => {
        const lines = YamlDiff.of(textOf(['a', 'gone', 'b']), textOf(['a', 'b']))

        expect(YamlDiff.summary(lines)).toEqual({ added: 0, removed: 1 })
    })
})

describe('YamlDiff.touchedLines', () => {
    it('names the lines of the edited document an addition lands on', () => {
        const lines = YamlDiff.of(textOf(['a', 'b', 'c']), textOf(['a', 'x', 'b', 'c']))

        expect(YamlDiff.touchedLines(lines)).toEqual([2])
    })

    it('anchors a removal on the line that now stands in its place', () => {
        const lines = YamlDiff.of(textOf(['a', 'gone', 'b']), textOf(['a', 'b']))

        expect(YamlDiff.touchedLines(lines)).toEqual([2])
    })

    it('marks nothing when nothing changed', () => {
        expect(YamlDiff.touchedLines(YamlDiff.of('a: 1', 'a: 1'))).toEqual([])
    })
})

describe('YamlDiff.condense', () => {
    it('keeps the change and its context and folds the rest into one gap', () => {
        const left = Array.from({ length: 30 }, (_, index) => `line ${index}`)
        const right = [...left]
        right[15] = 'changed'

        const condensed = YamlDiff.condense(YamlDiff.compare(left, right), 2)

        expect(condensed.filter(line => line.kind === 'gap')).toHaveLength(2)
        expect(condensed.some(line => line.text === 'changed')).toBe(true)
        expect(condensed.length).toBeLessThan(left.length)
    })

    it('leaves a short diff alone', () => {
        const lines = YamlDiff.of(textOf(['a', 'b']), textOf(['a', 'c']))

        expect(YamlDiff.condense(lines, 3).filter(line => line.kind === 'gap')).toHaveLength(0)
    })
})
