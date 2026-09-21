import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class KubeconfigClusterEntity extends RepoEntityBase<KubeconfigClusterEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    name: string

    @RepoEntityField()
    server: string

    @RepoEntityField()
    certificateAuthority: string

    @RepoEntityField()
    certificateAuthorityData: string

    @RepoEntityField()
    insecureSkipTlsVerify: boolean

    @RepoEntityField()
    tlsServerName: string

    @RepoEntityField()
    proxyUrl: string

    /** The kubeconfig this entry came from; relative file references resolve against its folder. */
    @RepoEntityField({ isClientOnly: true })
    filePath: string
}
