import { describe, expect, it } from 'vitest'
import { CustomResourceEntity, KubeObjectHealth, KubeObjectKey } from '@/domain/entities/kube'
import { NodeEntity } from '@/domain/entities/cluster'

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
})
