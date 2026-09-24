import { describe, expect, it } from 'vitest'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { DetailTaints } from '@/components/resource/detail/DetailTaints'
import { KubeClusterCatalog, KubeResourceRegistry } from '@/domain/models/kube'

const kind = (group: string, resource: string) => KubeResourceRegistry.find(group, resource)!

// Synthetic and deliberately not a credential: "hello-world" and "level=debug".
const secret = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'app', namespace: 'dev' },
    type: 'Opaque',
    data: { greeting: 'aGVsbG8td29ybGQ=' },
}

const configMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: 'app', namespace: 'dev' },
    data: { level: 'debug' },
    binaryData: { blob: 'AAEC' },
}

describe('DetailDataEntries', () => {
    it('lists a secret key without carrying its value', () => {
        const [entry] = DetailDataEntries.of(secret, kind('', 'secrets'))

        expect(entry).toEqual({ key: 'greeting', field: 'data', encoded: true, binary: false, hidden: true, size: 11 })
        expect(JSON.stringify(DetailDataEntries.of(secret, kind('', 'secrets')))).not.toContain('hello-world')
    })

    it('hands over one value only when it is asked for by key', () => {
        const [entry] = DetailDataEntries.of(secret, kind('', 'secrets'))

        expect(DetailDataEntries.valueOf(secret, entry)).toBe('hello-world')
    })

    it('does not hide a config map, which is not secret', () => {
        const entries = DetailDataEntries.of(configMap, kind('', 'configmaps'))

        expect(entries.map(entry => entry.key)).toEqual(['level', 'blob'])
        expect(entries.every(entry => entry.hidden)).toBe(false)
        expect(DetailDataEntries.valueOf(configMap, entries[0])).toBe('debug')
    })

    it('marks binary data as binary and never calls it printable', () => {
        const binary = DetailDataEntries.of(configMap, kind('', 'configmaps'))[1]

        expect(binary).toMatchObject({ field: 'binaryData', encoded: true, binary: true })
        expect(DetailDataEntries.isPrintable(configMap, binary)).toBe(false)
    })

    it('finds nothing on an object with no data map', () => {
        expect(DetailDataEntries.of({ metadata: {} }, kind('', 'secrets'))).toEqual([])
    })
})

describe('DetailDataEntries filtering and copying', () => {
    const settings = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'settings', namespace: 'dev' },
        data: { 'log.level': 'debug', 'app.conf': 'mode=fast\nport=8080\n', empty: '' },
        binaryData: { blob: 'AAEC' },
    }
    const entries = DetailDataEntries.of(settings, kind('', 'configmaps'))
    const keysOf = (found: { key: string }[]): string[] => found.map(entry => entry.key)

    it('keeps every entry for an empty query', () => {
        expect(keysOf(DetailDataEntries.filter(settings, entries, '  '))).toEqual(['app.conf', 'empty', 'log.level', 'blob'])
    })

    it('matches a config map key regardless of case', () => {
        expect(keysOf(DetailDataEntries.filter(settings, entries, 'LOG'))).toEqual(['log.level'])
    })

    it('matches a config map value', () => {
        expect(keysOf(DetailDataEntries.filter(settings, entries, '8080'))).toEqual(['app.conf'])
    })

    it('matches a secret by key but never by its hidden value', () => {
        const secretEntries = DetailDataEntries.of(secret, kind('', 'secrets'))

        expect(keysOf(DetailDataEntries.filter(secret, secretEntries, 'greet'))).toEqual(['greeting'])
        expect(DetailDataEntries.filter(secret, secretEntries, 'hello')).toEqual([])
    })

    it('hands back the same entry objects so a row keeps its state while the filter changes', () => {
        expect(DetailDataEntries.filter(settings, entries, 'log')[0]).toBe(entries[2])
    })

    it('copies text values, empty ones included, and leaves binary data out', () => {
        expect(DetailDataEntries.pairsOf(settings, entries)).toEqual([
            { key: 'app.conf', value: 'mode=fast\nport=8080\n' },
            { key: 'empty', value: '' },
            { key: 'log.level', value: 'debug' },
        ])
    })

    it('copies a secret decoded', () => {
        const [entry] = DetailDataEntries.of(secret, kind('', 'secrets'))

        expect(DetailDataEntries.pairOf(secret, entry)).toEqual({ key: 'greeting', value: 'hello-world' })
        expect(DetailDataEntries.isCopyable(secret, entry)).toBe(true)
    })
})

describe('DetailTabs', () => {
    it('shows the data of config maps and secrets on the overview rather than a tab of its own', () => {
        expect(DetailTabs.of(kind('', 'secrets')).map(tab => tab.key))
            .toEqual(['overview', 'details', 'metadata', 'events', 'yaml'])
        expect(DetailTabs.of(kind('', 'configmaps')).map(tab => tab.key))
            .toEqual(['overview', 'details', 'metadata', 'events', 'yaml'])
    })

    it('gives a Pods tab to nodes only', () => {
        expect(DetailTabs.of(kind('', 'nodes')).map(tab => tab.key)).toContain(DetailTabs.podsKey)
        expect(DetailTabs.of(kind('', 'pods')).map(tab => tab.key)).not.toContain(DetailTabs.podsKey)
    })

    it('keeps overview first and YAML last', () => {
        const tabs = DetailTabs.of(kind('', 'nodes')).map(tab => tab.key)

        expect(tabs[0]).toBe(DetailTabs.overviewKey)
        expect(tabs[tabs.length - 1]).toBe(DetailTabs.yamlKey)
    })
})

describe('DetailTaints', () => {
    it('reads a node taint and tones it by what it does', () => {
        const node = {
            spec: {
                taints: [
                    { key: 'node-role.kubernetes.io/control-plane', effect: 'NoSchedule' },
                    { key: 'dedicated', value: 'gpu', effect: 'NoExecute' },
                    { key: 'spot', effect: 'PreferNoSchedule' },
                    { effect: 'NoSchedule' },
                ],
            },
        }

        expect(DetailTaints.of(node)).toEqual([
            { key: 'node-role.kubernetes.io/control-plane', value: '', effect: 'NoSchedule', tone: 'warning' },
            { key: 'dedicated', value: 'gpu', effect: 'NoExecute', tone: 'error' },
            { key: 'spot', value: '', effect: 'PreferNoSchedule', tone: 'pending' },
        ])
    })

    it('finds nothing on an object with no taints', () => {
        expect(DetailTaints.of({ spec: {} })).toEqual([])
        expect(DetailTaints.of({})).toEqual([])
    })
})

describe('KubeClusterCatalog', () => {
    it('recognises the kinds that get their own treatment', () => {
        expect(KubeClusterCatalog.isSecret(kind('', 'secrets'))).toBe(true)
        expect(KubeClusterCatalog.isConfigMap(kind('', 'configmaps'))).toBe(true)
        expect(KubeClusterCatalog.isNode(kind('', 'nodes'))).toBe(true)
        expect(KubeClusterCatalog.isNamespace(kind('', 'namespaces'))).toBe(true)
        expect(KubeClusterCatalog.isEvent(kind('', 'events'))).toBe(true)
        expect(KubeClusterCatalog.isCrd(kind('apiextensions.k8s.io', 'customresourcedefinitions'))).toBe(true)
    })

    it('mistakes nothing else for them', () => {
        const pods = kind('', 'pods')

        expect(KubeClusterCatalog.hasDataMap(pods)).toBe(false)
        expect(KubeClusterCatalog.isNode(pods)).toBe(false)
        expect(KubeClusterCatalog.isEvent(pods)).toBe(false)
    })

    it('needs the patch verb before it offers to cordon or drain', () => {
        const readOnly = kind('', 'nodes').withDefinition({ verbs: ['list', 'get'] })

        expect(KubeClusterCatalog.canCordon(kind('', 'nodes'))).toBe(true)
        expect(KubeClusterCatalog.canDrain(readOnly)).toBe(false)
    })
})
