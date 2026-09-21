import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TLoadBalancerStatus } from '@/domain/entities/network/types/TLoadBalancerStatus'
import type { TServicePort } from '@/domain/entities/network/types/TServicePort'
import type { TServiceSpec } from '@/domain/entities/network/types/TServiceSpec'
import type { TServiceType } from '@/domain/entities/network/types/TServiceType'

export class ServiceEntity extends RepoEntityBase<ServiceEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TServiceSpec

    @RepoEntityField({ isReadonly: true })
    status: TLoadBalancerStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get type(): TServiceType {
        return this.spec?.type ?? 'ClusterIP'
    }

    get clusterIp(): string {
        return this.spec?.clusterIP ?? ''
    }

    get ports(): TServicePort[] {
        return this.spec?.ports ?? []
    }

    get portsText(): string {
        return this.ports.map(p => (p.nodePort ? `${p.port}:${p.nodePort}` : `${p.port}`)).join(', ')
    }

    get externalAddresses(): string[] {
        const assigned = (this.status?.loadBalancer?.ingress ?? [])
            .map(p => p.ip ?? p.hostname ?? '')
            .filter(p => p.length > 0)
        return [...assigned, ...(this.spec?.externalIPs ?? [])]
    }

    get externalAddressText(): string {
        return this.externalAddresses.join(', ')
    }

    // Only a LoadBalancer waits for something: every other type is usable the
    // moment the API server has accepted it.
    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.type !== 'LoadBalancer') {
            return 'ok'
        }
        return this.externalAddresses.length > 0 ? 'ok' : 'pending'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
