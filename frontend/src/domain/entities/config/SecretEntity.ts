import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { KubeDataMapReader } from '@/domain/entities/config/KubeDataMapReader'
import { SecretTypeCatalog } from '@/domain/entities/config/SecretTypeCatalog'
import type { TKubeDataMap } from '@/domain/entities/config/types/TKubeDataMap'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import { X509CertificateParser, X509ValidityCatalog } from '@/domain/models/certificate'
import type { TX509Chain } from '@/domain/models/certificate'

export class SecretEntity extends RepoEntityBase<SecretEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    type: string

    @RepoEntityField()
    data: TKubeDataMap

    @RepoEntityField()
    immutable: boolean

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get typeTitle(): string {
        return SecretTypeCatalog.title(this.type ?? '')
    }

    get keys(): string[] {
        return Object.keys(this.data ?? {})
    }

    get keyCount(): number {
        return this.keys.length
    }

    get tlsChain(): TX509Chain | null {
        if (this.type !== 'kubernetes.io/tls' || !this.data?.['tls.crt']) {
            return null
        }

        const pem = KubeDataMapReader.decode(this.data, 'tls.crt')

        return pem ? X509CertificateParser.parsePem(pem) : null
    }

    get state(): TKubeObjectState | undefined {
        const chain = this.tlsChain

        return chain ? X509ValidityCatalog.state(chain.worstValidity) : undefined
    }

    get stateLabel(): string | undefined {
        const chain = this.tlsChain

        return chain ? X509ValidityCatalog.label(chain.worstValidity) : undefined
    }
}
