import { describe, expect, it } from 'vitest'
import { PodLogKey } from '@/domain/models/kube'
import { TerminalKey, TerminalKindCatalog } from '@/domain/models/terminal'

describe('TerminalKey', () => {
    it('builds a key that carries the cluster', () => {
        const key = TerminalKey.of('prod', 'abc')

        expect(key).toBe('term|prod|abc')
        expect(TerminalKey.clusterOf(key)).toBe('prod')
    })

    it('recognises only its own keys', () => {
        expect(TerminalKey.isTerminal(TerminalKey.of('prod', 'abc'))).toBe(true)
        expect(TerminalKey.isTerminal(PodLogKey.of('prod', 'default', 'api-0', 'app'))).toBe(false)
        expect(TerminalKey.clusterOf('logs|prod|default|api-0|app')).toBe('')
    })

    it('keeps two terminals of the same pod apart', () => {
        expect(TerminalKey.of('prod', 'one')).not.toBe(TerminalKey.of('prod', 'two'))
    })
})

describe('TerminalKindCatalog', () => {
    it('titles every kind it lists', () => {
        TerminalKindCatalog.all().forEach((kind) => {
            expect(TerminalKindCatalog.title(kind).length).toBeGreaterThan(0)
        })
    })

    it('falls back to a local shell for anything it does not know', () => {
        expect(TerminalKindCatalog.parse('exec')).toBe('exec')
        expect(TerminalKindCatalog.parse('nonsense')).toBe('local')
        expect(TerminalKindCatalog.parse(7)).toBe('local')
    })
})
