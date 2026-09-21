import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TIngressSpec } from '@/domain/entities/network/types/TIngressSpec'
import type { TLoadBalancerStatus } from '@/domain/entities/network/types/TLoadBalancerStatus'

export class IngressEntity extends RepoEntityBase<IngressEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TIngressSpec

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

    get ingressClassName(): string {
        return this.spec?.ingressClassName ?? ''
    }

    get hosts(): string[] {
        return (this.spec?.rules ?? []).map(p => p.host ?? '').filter(p => p.length > 0)
    }

    get hostsText(): string {
        return this.hosts.join(', ')
    }

    get addresses(): string[] {
        return (this.status?.loadBalancer?.ingress ?? [])
            .map(p => p.ip ?? p.hostname ?? '')
            .filter(p => p.length > 0)
    }

    get addressText(): string {
        return this.addresses.join(', ')
    }

    get hasTls(): boolean {
        return (this.spec?.tls ?? []).length > 0
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        return this.addresses.length > 0 ? 'ok' : 'pending'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
