import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TEndpointSubset } from '@/domain/entities/network/types/TEndpointSubset'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

// Endpoints carry their addresses at the top level of the object, not in a spec.
export class EndpointsEntity extends RepoEntityBase<EndpointsEntity> {
    public static readonly maxListedAddresses: number = 3

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    subsets: TEndpointSubset[]

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get readyAddresses(): string[] {
        return EndpointsEntity.flatten(this.subsets, subset => subset.addresses)
    }

    get notReadyAddresses(): string[] {
        return EndpointsEntity.flatten(this.subsets, subset => subset.notReadyAddresses)
    }

    get endpointsText(): string {
        const pairs: string[] = []
        ;(this.subsets ?? []).forEach((subset) => {
            const ports = (subset.ports ?? []).map(port => port.port).filter(port => port !== undefined)
            ;(subset.addresses ?? []).forEach((address) => {
                if (!address.ip) {
                    return
                }
                if (ports.length === 0) {
                    pairs.push(address.ip)
                    return
                }
                ports.forEach(port => pairs.push(`${address.ip}:${port}`))
            })
        })

        const listed = pairs.slice(0, EndpointsEntity.maxListedAddresses).join(', ')
        const rest = pairs.length - EndpointsEntity.maxListedAddresses

        return rest > 0 ? `${listed} +${rest}` : listed
    }

    get readyCount(): number {
        return this.readyAddresses.length
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.readyCount > 0) {
            return this.notReadyAddresses.length > 0 ? 'warning' : 'ok'
        }
        return this.notReadyAddresses.length > 0 ? 'error' : 'pending'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }

    private static flatten(
        subsets: TEndpointSubset[] | undefined,
        pick: (subset: TEndpointSubset) => { ip?: string }[] | undefined,
    ): string[] {
        return (subsets ?? [])
            .flatMap(subset => pick(subset) ?? [])
            .map(address => address.ip ?? '')
            .filter(ip => ip.length > 0)
    }
}
