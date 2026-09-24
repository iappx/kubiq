import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ResourceDataYaml } from '@/application/services/resourceData/models/ResourceDataYaml'

describe('ResourceDataYaml', () => {
    it('writes single-line values as a plain key: value map', () => {
        const text = ResourceDataYaml.of([
            { key: 'debug', value: 'false' },
            { key: 'cluster-name', value: 'default' },
        ])

        expect(text).toBe('debug: "false"\ncluster-name: default\n')
    })

    it('writes a multi-line value as a literal block', () => {
        const text = ResourceDataYaml.of([{ key: 'app.properties', value: 'mode=fast\nlevel=debug\n' }])

        expect(text).toBe('app.properties: |\n  mode=fast\n  level=debug\n')
    })

    it('keeps a missing trailing newline through the block chomping indicator', () => {
        const text = ResourceDataYaml.of([{ key: 'script', value: 'echo one\necho two' }])

        expect(text.startsWith('script: |')).toBe(true)
        expect(parse(text)).toEqual({ script: 'echo one\necho two' })
    })

    it('reads back to exactly the values it was given', () => {
        const pairs = [
            { key: 'plain', value: 'value' },
            { key: 'empty', value: '' },
            { key: 'number-like', value: '8080' },
            { key: 'yes-like', value: 'yes' },
            { key: 'colon', value: 'a: b' },
            { key: 'hash', value: '# not a comment' },
            { key: 'leading spaces', value: '  indented\nnext' },
            { key: 'trailing blank lines', value: 'a\n\n\n' },
            { key: 'tabbed', value: 'a\tb\nc' },
            { key: 'quote"s', value: '\'single\' and "double"' },
            { key: 'config.yaml', value: 'root:\n  child: 1\n  list:\n    - x\n' },
        ]

        const text = ResourceDataYaml.of(pairs)
        const expected = Object.fromEntries(pairs.map(pair => [pair.key, pair.value]))

        expect(parse(text)).toEqual(expected)
    })

    it('does not fold long lines', () => {
        const long = 'x'.repeat(300)

        expect(ResourceDataYaml.of([{ key: 'long', value: long }])).toBe(`long: ${long}\n`)
    })

    it('gives nothing for no pairs', () => {
        expect(ResourceDataYaml.of([])).toBe('')
    })
})
