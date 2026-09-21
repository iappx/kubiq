import { describe, expect, it } from 'vitest'
import { HelmOperationPlan } from '@/application/services/helm/models/HelmOperationPlan'

describe('HelmOperationPlan', () => {
    it('carries the edited values with an install and creates the namespace when asked', () => {
        const plan = HelmOperationPlan.install({
            releaseName: 'web',
            namespace: 'dev',
            createNamespace: true,
            chart: 'bitnami/nginx',
            version: '15.1.0',
            values: 'replicaCount: 2\n',
        })

        expect(plan.args).toEqual([
            'install', 'web', 'bitnami/nginx', '--version', '15.1.0', '--create-namespace', '--namespace', 'dev',
        ])
        expect(plan.values).toBe('replicaCount: 2\n')
    })

    it('replaces the stored values on an upgrade unless the operator asked to keep them', () => {
        expect(HelmOperationPlan.upgrade({
            releaseName: 'web',
            namespace: 'dev',
            chart: 'bitnami/nginx',
            version: '',
            values: '',
            reuseValues: false,
        }).args).toContain('--reset-values')

        expect(HelmOperationPlan.upgrade({
            releaseName: 'web',
            namespace: 'dev',
            chart: 'bitnami/nginx',
            version: '',
            values: '',
            reuseValues: true,
        }).args).toContain('--reuse-values')
    })

    it('sends no values file with an uninstall or a rollback', () => {
        const uninstall = HelmOperationPlan.uninstall({ name: 'web', namespace: 'dev' }, true)
        const rollback = HelmOperationPlan.rollback({ name: 'web', namespace: 'dev' }, 2)

        expect(uninstall.args).toEqual(['uninstall', 'web', '--keep-history', '--namespace', 'dev'])
        expect(uninstall.values).toBeUndefined()
        expect(rollback.args).toEqual(['rollback', 'web', '2', '--namespace', 'dev'])
        expect(rollback.values).toBeUndefined()
    })
})
