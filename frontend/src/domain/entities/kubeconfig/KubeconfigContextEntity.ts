import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import { KubeconfigClusterEntity } from '@/domain/entities/kubeconfig/KubeconfigClusterEntity'
import { KubeconfigUserEntity } from '@/domain/entities/kubeconfig/KubeconfigUserEntity'
import type { TKubeconfigAuthType } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthType'

export class KubeconfigContextEntity extends RepoEntityBase<KubeconfigContextEntity> {
    public static readonly DefaultNamespace = 'default'

    @RepoEntityField({ isPrimaryKey: true })
    name: string

    @RepoEntityField()
    clusterName: string

    @RepoEntityField()
    userName: string

    @RepoEntityField()
    namespace: string

    /** The kubeconfig this entry came from. */
    @RepoEntityField({ isClientOnly: true })
    filePath: string

    @RepoEntityField({ nestedType: () => KubeconfigClusterEntity })
    cluster: KubeconfigClusterEntity

    @RepoEntityField({ nestedType: () => KubeconfigUserEntity })
    user: KubeconfigUserEntity

    get server(): string {
        return this.cluster?.server ?? ''
    }

    get effectiveNamespace(): string {
        return this.namespace || KubeconfigContextEntity.DefaultNamespace
    }

    get authType(): TKubeconfigAuthType {
        return this.user?.authType ?? 'none'
    }

    get isSupported(): boolean {
        return KubeconfigAuthTypeCatalog.isSupported(this.authType)
    }

    get unsupportedReason(): string {
        return KubeconfigAuthTypeCatalog.reason(this.authType)
    }
}
