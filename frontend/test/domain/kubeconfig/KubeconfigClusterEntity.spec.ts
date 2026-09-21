import { describe, expect, it } from 'vitest'
import { KubeconfigClusterEntity } from '@/domain/entities/kubeconfig'

describe('KubeconfigClusterEntity', () => {
    it('keeps the name as its primary key', () => {
        expect(KubeconfigClusterEntity.build({ name: 'prod' }).getPkValue()).toBe('prod')
    })

    it('carries the address and the transport settings of the cluster', () => {
        const cluster = KubeconfigClusterEntity.build({
            name: 'prod',
            server: 'https://prod:6443',
            certificateAuthority: 'pki/ca.pem',
            certificateAuthorityData: 'ZmFrZQ==',
            insecureSkipTlsVerify: true,
            tlsServerName: 'prod.internal',
            proxyUrl: 'http://proxy:3128',
            filePath: 'C:/Users/tester/.kube/config',
        })

        expect(cluster.server).toBe('https://prod:6443')
        expect(cluster.certificateAuthority).toBe('pki/ca.pem')
        expect(cluster.certificateAuthorityData).toBe('ZmFrZQ==')
        expect(cluster.insecureSkipTlsVerify).toBe(true)
        expect(cluster.tlsServerName).toBe('prod.internal')
        expect(cluster.proxyUrl).toBe('http://proxy:3128')
        expect(cluster.filePath).toBe('C:/Users/tester/.kube/config')
    })

    it('leaves the file reference out of what it would write back', () => {
        const cluster = KubeconfigClusterEntity.build({ name: 'prod', filePath: 'C:/config' })

        expect(cluster.serialize()).not.toHaveProperty('filePath')
    })
})
