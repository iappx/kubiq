import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TIngressClassSpec } from '@/domain/entities/network/types/TIngressClassSpec'

export class IngressClassEntity extends RepoEntityBase<IngressClassEntity> {
    public static readonly defaultAnnotation: string = 'ingressclass.kubernetes.io/is-default-class'

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TIngressClassSpec

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get controller(): string {
        return this.spec?.controller ?? ''
    }

    get isDefault(): boolean {
        return this.metadata?.annotation(IngressClassEntity.defaultAnnotation) === 'true'
    }
}
