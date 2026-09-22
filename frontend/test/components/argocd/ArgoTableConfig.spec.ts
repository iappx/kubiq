import { describe, expect, it } from 'vitest'
import { ArgoApplicationActions } from '@/components/argocd/ArgoApplicationActions'
import { ArgoApplicationColumns } from '@/components/argocd/ArgoApplicationColumns'
import { ArgoApplicationSetColumns } from '@/components/argocd/ArgoApplicationSetColumns'
import { ArgoApplicationSetRowBuilder } from '@/components/argocd/ArgoApplicationSetRowBuilder'
import { ArgoProjectColumns } from '@/components/argocd/ArgoProjectColumns'
import { ArgoProjectRowBuilder } from '@/components/argocd/ArgoProjectRowBuilder'
import { ArgoToneMap } from '@/components/argocd/ArgoToneMap'
import { ArgoApplicationEntity, ArgoApplicationSetEntity, ArgoAppProjectEntity } from '@/domain/entities/argocd'

describe('ArgoApplicationColumns', () => {
    it('locks the columns that do the work, so they cannot be hidden', () => {
        const locked = ArgoApplicationColumns.all().filter(column => column.locked).map(column => column.key)

        expect(locked).toEqual(['name', 'syncText', 'healthText', 'createdAt'])
    })

    it('starts no locked column hidden', () => {
        const hidden = ArgoApplicationColumns.hiddenByDefault()
        const locked = ArgoApplicationColumns.all().filter(column => column.locked).map(column => column.key)

        expect(hidden.some(key => locked.includes(key))).toBe(false)
    })

    it('leaves at most seven columns visible on a first open', () => {
        const visible = ArgoApplicationColumns.all()
            .filter(column => !ArgoApplicationColumns.hiddenByDefault().includes(column.key))

        expect(visible.length).toBeLessThanOrEqual(7)
    })

    it('names a hidden column that actually exists', () => {
        const keys = ArgoApplicationColumns.all().map(column => column.key)

        expect(ArgoApplicationColumns.hiddenByDefault().every(key => keys.includes(key))).toBe(true)
        expect(ArgoProjectColumns.hiddenByDefault().every(key =>
            ArgoProjectColumns.all().map(column => column.key).includes(key))).toBe(true)
        expect(ArgoApplicationSetColumns.hiddenByDefault().every(key =>
            ArgoApplicationSetColumns.all().map(column => column.key).includes(key))).toBe(true)
    })
})

describe('ArgoApplicationActions', () => {
    it('offers nothing a read-only session cannot do', () => {
        const keys = ArgoApplicationActions.forCapabilities(false, false).map(item => item.key)

        expect(keys).toEqual([ArgoApplicationActions.history])
    })

    it('offers the write actions once the cluster allows them', () => {
        const keys = ArgoApplicationActions.forCapabilities(true, true).map(item => item.key)

        expect(keys).toEqual([
            ArgoApplicationActions.sync,
            ArgoApplicationActions.refresh,
            ArgoApplicationActions.hardRefresh,
            ArgoApplicationActions.history,
            ArgoApplicationActions.remove,
        ])
    })

    it('keeps the delete apart and marks it dangerous', () => {
        const remove = ArgoApplicationActions.forCapabilities(true, true)
            .find(item => item.key === ArgoApplicationActions.remove)

        expect(remove?.danger).toBe(true)
        expect(remove?.separatorBefore).toBe(true)
    })

    it('leaves the delete out when the cluster refuses it', () => {
        const keys = ArgoApplicationActions.forCapabilities(true, false).map(item => item.key)

        expect(keys).not.toContain(ArgoApplicationActions.remove)
    })
})

describe('ArgoToneMap', () => {
    it('reads a drift as a warning and a degraded application as an error', () => {
        expect(ArgoToneMap.ofSync('OutOfSync')).toBe('warning')
        expect(ArgoToneMap.ofHealth('Degraded')).toBe('error')
        expect(ArgoToneMap.ofHealth('Missing')).toBe('error')
    })

    it('reads a suspended or progressing application as pending, not as broken', () => {
        expect(ArgoToneMap.ofHealth('Suspended')).toBe('pending')
        expect(ArgoToneMap.ofHealth('Progressing')).toBe('pending')
    })

    it('has no tone for an operation that never ran', () => {
        expect(ArgoToneMap.ofPhase(undefined)).toBe('unknown')
        expect(ArgoToneMap.ofPhase('Failed')).toBe('error')
    })
})

describe('ArgoProjectRowBuilder', () => {
    const project = ArgoAppProjectEntity.build({
        uid: 'project-uid',
        metadata: { uid: 'project-uid', name: 'payments', namespace: 'argocd' },
        spec: { description: 'Payments team', sourceRepos: ['*'] },
    })

    const application = (projectName: string, uid: string) => ArgoApplicationEntity.build({
        uid,
        metadata: { uid, name: uid, namespace: 'argocd' },
        spec: { project: projectName },
    })

    it('counts the applications that belong to the project', () => {
        const [row] = ArgoProjectRowBuilder.build([project], [
            application('payments', 'a'),
            application('payments', 'b'),
            application('billing', 'c'),
        ])

        expect(row.applicationCount).toBe(2)
    })

    it('reads the project fields the table shows', () => {
        const [row] = ArgoProjectRowBuilder.build([project], [])

        expect(row).toMatchObject({
            key: 'project-uid',
            name: 'payments',
            description: 'Payments team',
            sourceRepos: 'Any',
        })
    })
})

describe('ArgoApplicationSetRowBuilder', () => {
    it('reads the generators and the status word', () => {
        const [row] = ArgoApplicationSetRowBuilder.build([ArgoApplicationSetEntity.build({
            uid: 'set-uid',
            metadata: { uid: 'set-uid', name: 'teams', namespace: 'argocd' },
            spec: { generators: [{ git: {} }], template: { spec: { project: 'payments' } } },
            status: { conditions: [{ type: 'ErrorOccurred', status: 'True' }] },
        })])

        expect(row).toMatchObject({
            key: 'set-uid',
            name: 'teams',
            project: 'payments',
            generators: 'git',
            strategy: 'AllAtOnce',
            tone: 'error',
            statusText: 'Error',
        })
    })
})
