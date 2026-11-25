import { describe, expect, it } from 'vitest'
import { CustomResourceEntity, KubeObjectHealth, KubeObjectKey } from '@/domain/entities/kube'
import { NodeEntity } from '@/domain/entities/cluster'
import { SecretEntity } from '@/domain/entities/config'
import { DeploymentEntity } from '@/domain/entities/workloads'

const entity = (data: Record<string, unknown>) => CustomResourceEntity.build(data)

describe('KubeObjectKey', () => {
    it('identifies an object by its uid', () => {
        expect(KubeObjectKey.of(entity({ uid: 'abc', metadata: { name: 'api', namespace: 'payments' } }))).toBe('abc')
    })

    it('reads the same key off a raw object as off the entity built from it', () => {
        const object = { metadata: { uid: 'abc', name: 'api', namespace: 'payments' } }

        expect(KubeObjectKey.ofObject(object)).toBe(KubeObjectKey.of(entity({ uid: 'abc', metadata: object.metadata })))
    })

    it('falls back to namespace and name when there is no uid', () => {
        expect(KubeObjectKey.of(entity({ metadata: { name: 'api', namespace: 'payments' } }))).toBe('payments/api')
    })

    it('uses the bare name for a cluster-scoped object with no uid', () => {
        expect(KubeObjectKey.of(entity({ metadata: { name: 'node-a' } }))).toBe('node-a')
    })
})

describe('KubeObjectHealth', () => {
    it('reads the state an entity reports', () => {
        const ready = NodeEntity.build({
            metadata: { uid: 'n1', name: 'node-a' },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
        })

        expect(KubeObjectHealth.stateOf(ready)).toBe('ok')
        expect(KubeObjectHealth.isProblematic(ready)).toBe(false)
    })

    it('treats an object with no state of its own as unknown', () => {
        expect(KubeObjectHealth.stateOf(entity({ metadata: { name: 'x' } }))).toBe('unknown')
    })

    it('counts only warnings and errors as needing attention', () => {
        const nodes = [
            NodeEntity.build({ metadata: { name: 'a' }, status: { conditions: [{ type: 'Ready', status: 'True' }] } }),
            NodeEntity.build({ metadata: { name: 'b' }, status: { conditions: [{ type: 'Ready', status: 'False' }] } }),
            NodeEntity.build({ metadata: { name: 'c' }, spec: { unschedulable: true }, status: { conditions: [{ type: 'Ready', status: 'True' }] } }),
        ]

        expect(KubeObjectHealth.countProblems(nodes)).toBe(2)
    })

    it('distinguishes stateful entities from stateless ones with hasState', () => {
        const node = NodeEntity.build({
            metadata: { uid: 'n1', name: 'node-a' },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
        })
        const secret = SecretEntity.build({
            uid: 's1',
            metadata: { uid: 's1', name: 'tls-cert', namespace: 'default' },
            type: 'kubernetes.io/tls',
        })

        expect(KubeObjectHealth.hasState(node)).toBe(true)
        expect(KubeObjectHealth.hasState(entity({ metadata: { name: 'x' } }))).toBe(true)
        expect(KubeObjectHealth.hasState(secret)).toBe(false)
    })

    it('uses stateLabel when an entity declares one and falls back to the catalog title', () => {
        const progressing = DeploymentEntity.build({
            uid: 'd1',
            metadata: { uid: 'd1', name: 'vaultls', namespace: 'default', generation: 2 },
            spec: { replicas: 1 },
            status: {
                readyReplicas: 0,
                availableReplicas: 0,
                observedGeneration: 2,
                conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }],
            },
        })
        const readyNode = NodeEntity.build({
            metadata: { uid: 'n1', name: 'node-a' },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
        })
        const secret = SecretEntity.build({
            uid: 's1',
            metadata: { uid: 's1', name: 'tls-cert', namespace: 'default' },
            type: 'kubernetes.io/tls',
        })

        expect(KubeObjectHealth.labelOf(progressing)).toBe('Progressing')
        expect(KubeObjectHealth.labelOf(readyNode)).toBe('Healthy')
        expect(KubeObjectHealth.labelOf(secret)).toBe('Unknown')
    })
})
