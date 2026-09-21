import { describe, expect, it } from 'vitest'
import { NodeEntity } from '@/domain/entities/cluster'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): NodeEntity => NodeEntity.build(KubeObjectFixtures.withUid(object))

describe('NodeEntity', () => {
    it('exposes the column values the registry names', () => {
        const node = build(KubeObjectFixtures.node())

        expect(node.name).toBe('worker-1')
        expect(node.internalIp).toBe('192.168.1.11')
        expect(node.kubeletVersion).toBe('v1.31.1')
        expect(node.osImage).toBe('Ubuntu 24.04.1 LTS')
        expect(node.containerRuntime).toBe('containerd://1.7.22')
        expect(node.architecture).toBe('amd64')
    })

    it('reads roles from the node-role labels only', () => {
        expect(build(KubeObjectFixtures.node()).roles).toEqual(['worker'])
    })

    it('is healthy when Ready is true and nothing is under pressure', () => {
        const node = build(KubeObjectFixtures.node())

        expect(node.isReady).toBe(true)
        expect(node.pressures).toEqual([])
        expect(node.state).toBe('ok')
    })

    it('is an error when Ready is false', () => {
        const source = KubeObjectFixtures.node()
        source.status.conditions = [{ type: 'Ready', status: 'False', reason: 'KubeletNotReady' }]

        expect(build(source).state).toBe('error')
    })

    it('is a warning when a pressure condition fires', () => {
        const source = KubeObjectFixtures.node()
        source.status.conditions = [
            { type: 'Ready', status: 'True' },
            { type: 'DiskPressure', status: 'True' },
        ]

        const node = build(source)

        expect(node.pressures).toEqual(['DiskPressure'])
        expect(node.state).toBe('warning')
    })

    it('is a warning while cordoned', () => {
        const source = KubeObjectFixtures.node()
        source.spec.unschedulable = true

        const node = build(source)

        expect(node.isCordoned).toBe(true)
        expect(node.state).toBe('warning')
    })

    it('is unknown when the cluster reports no Ready condition', () => {
        const source = KubeObjectFixtures.node()
        source.status.conditions = []

        expect(build(source).state).toBe('unknown')
    })

    it('counts taints', () => {
        const source = KubeObjectFixtures.node()
        source.spec.taints = [{ key: 'dedicated', value: 'gpu', effect: 'NoSchedule' }]

        expect(build(source).taintCount).toBe(1)
    })
})
