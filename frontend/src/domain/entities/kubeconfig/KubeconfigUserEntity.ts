import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import type { TKubeconfigAuthProvider } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthProvider'
import type { TKubeconfigAuthType } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthType'
import type { TKubeconfigExecConfig } from '@/domain/entities/kubeconfig/types/TKubeconfigExecConfig'

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

    @RepoEntityField()
    execConfig?: TKubeconfigExecConfig

    @RepoEntityField()
    authProvider?: TKubeconfigAuthProvider

    // Relative file references in this entry resolve against this kubeconfig's folder, not the working directory.
    @RepoEntityField({ isClientOnly: true })
    filePath: string

    // A plugin answers for the whole entry even next to a certificate, so it is
    // read first: picking the certificate would connect as somebody else.
    get authType(): TKubeconfigAuthType {
        if (this.usesExec || this.execConfig) {
            return 'exec'
        }
        if (this.usesAuthProvider || this.authProvider) {
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

    get unsupportedReason(): string {
        return KubeconfigAuthTypeCatalog.unsupportedReasonFor(this.authType, this.execConfig, this.authProvider)
    }

    get isSupported(): boolean {
        return this.unsupportedReason === ''
    }
}
