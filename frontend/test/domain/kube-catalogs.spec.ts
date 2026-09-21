import { describe, expect, it } from 'vitest'
import { KubeConditionStatusCatalog, KubeObjectStateCatalog } from '@/domain/entities/kube'
import { EventTypeCatalog, NamespacePhaseCatalog, NodeConditionCatalog } from '@/domain/entities/cluster'
import { SecretTypeCatalog } from '@/domain/entities/config'
import { ServiceTypeCatalog } from '@/domain/entities/network'
import {
    AccessModeCatalog,
    PersistentVolumeClaimPhaseCatalog,
    PersistentVolumePhaseCatalog,
} from '@/domain/entities/storage'
import {
    ContainerWaitingReasonCatalog,
    CronJobConcurrencyPolicyCatalog,
    PodPhaseCatalog,
    PodQosClassCatalog,
} from '@/domain/entities/workloads'
import { KubeSectionCatalog, KubeVerbCatalog } from '@/domain/models/kube'

const catalogs = [
    ['KubeObjectStateCatalog', KubeObjectStateCatalog],
    ['KubeConditionStatusCatalog', KubeConditionStatusCatalog],
    ['PodPhaseCatalog', PodPhaseCatalog],
    ['PodQosClassCatalog', PodQosClassCatalog],
    ['ContainerWaitingReasonCatalog', ContainerWaitingReasonCatalog],
    ['CronJobConcurrencyPolicyCatalog', CronJobConcurrencyPolicyCatalog],
    ['NodeConditionCatalog', NodeConditionCatalog],
    ['NamespacePhaseCatalog', NamespacePhaseCatalog],
    ['EventTypeCatalog', EventTypeCatalog],
    ['SecretTypeCatalog', SecretTypeCatalog],
    ['ServiceTypeCatalog', ServiceTypeCatalog],
    ['AccessModeCatalog', AccessModeCatalog],
    ['PersistentVolumePhaseCatalog', PersistentVolumePhaseCatalog],
    ['PersistentVolumeClaimPhaseCatalog', PersistentVolumeClaimPhaseCatalog],
    ['KubeSectionCatalog', KubeSectionCatalog],
    ['KubeVerbCatalog', KubeVerbCatalog],
] as const

describe('the kube catalogues', () => {
    it.each(catalogs)('%s answers has() for its own values and nothing else', (_name, catalog) => {
        const keys = Object.keys(catalog.values)

        expect(keys.length).toBeGreaterThan(0)
        for (const key of keys) {
            expect(catalog.has(key)).toBe(true)
        }
        expect(catalog.has('something-a-cluster-would-never-send')).toBe(false)
    })

    it.each(catalogs)('%s gives every value a non-empty title', (_name, catalog) => {
        for (const key of Object.keys(catalog.values)) {
            expect(catalog.title(key as never).length).toBeGreaterThan(0)
        }
    })

    it.each(catalogs)('%s falls back to the raw value it does not know', (_name, catalog) => {
        expect(catalog.title('SomethingNew' as never)).toBe('SomethingNew')
    })
})

describe('KubeObjectStateCatalog', () => {
    it('counts warning and error as worth flagging, and nothing else', () => {
        expect(KubeObjectStateCatalog.isProblematic('warning')).toBe(true)
        expect(KubeObjectStateCatalog.isProblematic('error')).toBe(true)
        expect(KubeObjectStateCatalog.isProblematic('ok')).toBe(false)
        expect(KubeObjectStateCatalog.isProblematic('pending')).toBe(false)
        expect(KubeObjectStateCatalog.isProblematic('unknown')).toBe(false)
    })
})

describe('ContainerWaitingReasonCatalog', () => {
    it('lets the two transient reasons through and treats the rest as faults', () => {
        expect(ContainerWaitingReasonCatalog.isError('ContainerCreating')).toBe(false)
        expect(ContainerWaitingReasonCatalog.isError('PodInitializing')).toBe(false)
        expect(ContainerWaitingReasonCatalog.isError('CrashLoopBackOff')).toBe(true)
        expect(ContainerWaitingReasonCatalog.isError('ImagePullBackOff')).toBe(true)
    })

    it('treats a reason it has never seen as a fault', () => {
        expect(ContainerWaitingReasonCatalog.isError('SomeNewKubeletReason')).toBe(true)
    })
})

describe('NodeConditionCatalog', () => {
    it('names every pressure condition and keeps Ready out of them', () => {
        expect(NodeConditionCatalog.pressureTypes()).toEqual([
            'MemoryPressure',
            'DiskPressure',
            'PIDPressure',
            'NetworkUnavailable',
        ])
        expect(NodeConditionCatalog.pressureTypes()).not.toContain(NodeConditionCatalog.ready)
    })
})

describe('AccessModeCatalog', () => {
    it('abbreviates the modes the way kubectl does', () => {
        expect(AccessModeCatalog.short('ReadWriteOnce')).toBe('RWO')
        expect(AccessModeCatalog.short('ReadOnlyMany')).toBe('ROX')
        expect(AccessModeCatalog.short('ReadWriteMany')).toBe('RWX')
        expect(AccessModeCatalog.short('ReadWriteOncePod')).toBe('RWOP')
        expect(AccessModeCatalog.short('Unheard-of')).toBe('Unheard-of')
    })
})

describe('KubeSectionCatalog', () => {
    it('orders the sections and puts custom resources last', () => {
        const sections = KubeSectionCatalog.all()

        expect(sections[0]).toBe('cluster')
        expect(sections[sections.length - 1]).toBe(KubeSectionCatalog.custom)
        expect(KubeSectionCatalog.orderOf('cluster')).toBeLessThan(KubeSectionCatalog.orderOf('workloads'))
        expect(KubeSectionCatalog.orderOf('custom')).toBe(sections.length - 1)
    })

    it('hands out a copy, so a caller cannot reorder the menu for everyone', () => {
        KubeSectionCatalog.all().reverse()

        expect(KubeSectionCatalog.all()[0]).toBe('cluster')
    })
})

describe('KubeVerbCatalog', () => {
    it('keeps only the verbs it models', () => {
        expect(KubeVerbCatalog.known(['get', 'list', 'bind', 'escalate', 'watch'])).toEqual(['get', 'list', 'watch'])
        expect(KubeVerbCatalog.known(undefined)).toEqual([])
    })
})
