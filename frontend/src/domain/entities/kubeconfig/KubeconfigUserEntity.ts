import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import type { TKubeconfigAuthType } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthType'

export class KubeconfigUserEntity extends RepoEntityBase<KubeconfigUserEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    name: string

    @RepoEntityField()
    clientCertificate: string

    @RepoEntityField()
    clientCertificateData: string

    @RepoEntityField()
    clientKey: string

    @RepoEntityField()
    clientKeyData: string

    @RepoEntityField()
    token: string

    @RepoEntityField()
    tokenFile: string

    @RepoEntityField()
    username: string

    @RepoEntityField()
    password: string

    @RepoEntityField()
    usesExec: boolean

    @RepoEntityField()
    usesAuthProvider: boolean

    /** The kubeconfig this entry came from; relative file references resolve against its folder. */
    @RepoEntityField({ isClientOnly: true })
    filePath: string

    // A plugin answers for the whole entry even next to a certificate, so it is
    // read first: picking the certificate would connect as somebody else.
    get authType(): TKubeconfigAuthType {
        if (this.usesExec) {
            return 'exec'
        }
        if (this.usesAuthProvider) {
            return 'authProvider'
        }
        if (this.clientCertificateData || this.clientCertificate) {
            return 'clientCertificate'
        }
        if (this.token || this.tokenFile) {
            return 'token'
        }
        if (this.username) {
            return 'basic'
        }
        return 'none'
    }

    get isSupported(): boolean {
        return KubeconfigAuthTypeCatalog.isSupported(this.authType)
    }
}
