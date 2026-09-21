import { describe, expect, it } from 'vitest'
import {
    KubeconfigClusterEntity,
    KubeconfigContextEntity,
    KubeconfigUserEntity,
} from '@/domain/entities/kubeconfig'

describe('KubeconfigContextEntity', () => {
    it('takes nested cluster and user entities as they are', () => {
        const cluster = KubeconfigClusterEntity.build({ name: 'prod', server: 'https://prod:6443' })
        const user = KubeconfigUserEntity.build({ name: 'prod-admin', token: 'fake-token' })

        const context = KubeconfigContextEntity.build({
            name: 'prod',
            clusterName: 'prod',
            userName: 'prod-admin',
            cluster,
            user,
        })

        expect(context.cluster).toBe(cluster)
        expect(context.user).toBe(user)
        expect(context.server).toBe('https://prod:6443')
        expect(context.authType).toBe('token')
    })

    it('builds nested entities out of plain data', () => {
        const context = KubeconfigContextEntity.build({
            name: 'prod',
            cluster: { name: 'prod', server: 'https://prod:6443' },
            user: { name: 'prod-admin', usesExec: true },
        })

        expect(context.cluster).toBeInstanceOf(KubeconfigClusterEntity)
        expect(context.user).toBeInstanceOf(KubeconfigUserEntity)
        expect(context.isSupported).toBe(false)
        expect(context.unsupportedReason).not.toBe('')
    })

    it('falls back to the default namespace when the context names none', () => {
        expect(KubeconfigContextEntity.build({ name: 'a' }).effectiveNamespace).toBe('default')
        expect(KubeconfigContextEntity.build({ name: 'a', namespace: 'payments' }).effectiveNamespace)
            .toBe('payments')
    })

    it('survives a context whose cluster and user are missing', () => {
        const context = KubeconfigContextEntity.build({ name: 'orphan', clusterName: 'gone' })

        expect(context.server).toBe('')
        expect(context.authType).toBe('none')
        expect(context.isSupported).toBe(true)
    })

    it('keeps the name as its primary key', () => {
        expect(KubeconfigContextEntity.build({ name: 'prod' }).getPkValue()).toBe('prod')
    })
})
