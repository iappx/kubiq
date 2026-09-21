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

    // Relative file references in this entry resolve against this kubeconfig's folder, not the working directory.
    @RepoEntityField({ isClientOnly: true })
    filePath: string
}
