import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'
import type { TNetworkPolicySpec } from '@/domain/entities/network/types/TNetworkPolicySpec'

export class NetworkPolicyEntity extends RepoEntityBase<NetworkPolicyEntity> {
    public static readonly allPodsText: string = '<all pods>'

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TNetworkPolicySpec

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get podSelector(): TKubeLabelSelector {
        return this.spec?.podSelector ?? {}
    }

    // An empty podSelector selects every pod in the namespace — the opposite of "selects nothing".
    get podSelectorText(): string {
        const labels = this.podSelector.matchLabels ?? {}
        const pairs = Object.keys(labels).map(key => `${key}=${labels[key]}`)
        const expressions = (this.podSelector.matchExpressions ?? []).length

        if (pairs.length === 0 && expressions === 0) {
            return NetworkPolicyEntity.allPodsText
        }

        return expressions > 0 ? [...pairs, `${expressions} expressions`].join(', ') : pairs.join(', ')
    }

    get policyTypes(): string[] {
        return this.spec?.policyTypes ?? []
    }

    get policyTypesText(): string {
        return this.policyTypes.join(', ')
    }

    get ruleCount(): number {
        return (this.spec?.ingress ?? []).length + (this.spec?.egress ?? []).length
    }
}
