import { EntityQuery } from '@iappx/entity-repo'
import { parse, YAMLParseError } from 'yaml'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeconfigClusterEntity } from '@/domain/entities/kubeconfig/KubeconfigClusterEntity'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import { KubeconfigUserEntity } from '@/domain/entities/kubeconfig/KubeconfigUserEntity'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { TKubeconfigDocument } from '@/infrastructure/entityRepo/kubeconfig/types/TKubeconfigDocument'
import type { TKubeconfigQueryOptions } from '@/infrastructure/entityRepo/kubeconfig/types/TKubeconfigQueryOptions'

export class KubeconfigEntityQuery
    extends EntityQuery<KubeconfigContextEntity, FileSystemTransport, TKubeconfigQueryOptions> {

    private static readonly ParseFailed = 'The kubeconfig file could not be read'

    private static readonly AbsolutePath = /^([a-zA-Z]:[\\/]|[\\/])/

    public forFile(path: string): KubeconfigEntityQuery {
        return new KubeconfigEntityQuery(this.entityConstructor, this.transport, { file: path })
    }

    public async getAll(): Promise<KubeconfigContextEntity[]> {
        const document = await this.document()
        if (!document) {
            return []
        }

        const clusters = this.byName(this.clustersOf(document))
        const users = this.byName(this.usersOf(document))

        return this.named(document.contexts).map(entry => KubeconfigContextEntity.build({
            name: entry.name,
            clusterName: entry.context?.cluster ?? '',
            userName: entry.context?.user ?? '',
            namespace: entry.context?.namespace ?? '',
            filePath: this.file,
            cluster: clusters.get(entry.context?.cluster ?? ''),
            user: users.get(entry.context?.user ?? ''),
        }))
    }

    public async getById(name: string): Promise<KubeconfigContextEntity | null> {
        const contexts = await this.getAll()
        return contexts.find(context => context.name === name) ?? null
    }

    public async getCurrentContextName(): Promise<string> {
        const document = await this.document()
        return document?.['current-context'] ?? ''
    }

    public async getClusters(): Promise<KubeconfigClusterEntity[]> {
        const document = await this.document()
        return document ? this.clustersOf(document) : []
    }

    public async getUsers(): Promise<KubeconfigUserEntity[]> {
        const document = await this.document()
        return document ? this.usersOf(document) : []
    }

    public async readCredentialFile(path: string): Promise<string> {
        const resolved = this.resolve(path)
        const content = await this.transport.send<string | null>({ path: resolved, operation: 'read' })

        if (content === null) {
            throw new ApiError('A file the kubeconfig refers to could not be read', resolved)
        }

        return content
    }

    private async document(): Promise<TKubeconfigDocument | null> {
        const content = await this.transport.send<string | null>({ path: this.file, operation: 'read' })
        if (!content?.trim()) {
            return null
        }

        let parsed: unknown
        try {
            parsed = parse(content)
        } catch (err) {
            throw new ApiError(KubeconfigEntityQuery.ParseFailed, this.position(err))
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new ApiError(KubeconfigEntityQuery.ParseFailed, `${this.file} — a kubeconfig document was expected`)
        }

        return parsed as TKubeconfigDocument
    }

    // The parser quotes the offending source line, and in a kubeconfig that line
    // can hold a token or a private key — only the position may leave this class.
    private position(err: unknown): string {
        const position = err instanceof YAMLParseError ? err.linePos?.[0] : undefined
        if (!position) {
            return `${this.file} — the file is not valid YAML`
        }
        return `${this.file} — YAML syntax error at line ${position.line}, column ${position.col}`
    }

    private clustersOf(document: TKubeconfigDocument): KubeconfigClusterEntity[] {
        return this.named(document.clusters).map(entry => KubeconfigClusterEntity.build({
            name: entry.name,
            server: entry.cluster?.server ?? '',
            certificateAuthority: entry.cluster?.['certificate-authority'] ?? '',
            certificateAuthorityData: entry.cluster?.['certificate-authority-data'] ?? '',
            insecureSkipTlsVerify: entry.cluster?.['insecure-skip-tls-verify'] === true,
            tlsServerName: entry.cluster?.['tls-server-name'] ?? '',
            proxyUrl: entry.cluster?.['proxy-url'] ?? '',
            filePath: this.file,
        }))
    }

    private usersOf(document: TKubeconfigDocument): KubeconfigUserEntity[] {
        return this.named(document.users).map(entry => KubeconfigUserEntity.build({
            name: entry.name,
            clientCertificate: entry.user?.['client-certificate'] ?? '',
            clientCertificateData: entry.user?.['client-certificate-data'] ?? '',
            clientKey: entry.user?.['client-key'] ?? '',
            clientKeyData: entry.user?.['client-key-data'] ?? '',
            token: entry.user?.token ?? '',
            tokenFile: entry.user?.tokenFile ?? '',
            username: entry.user?.username ?? '',
            password: entry.user?.password ?? '',
            usesExec: !!entry.user?.exec,
            usesAuthProvider: !!entry.user?.['auth-provider'],
            filePath: this.file,
        }))
    }

    // A hand-edited file may hold an entry with no name; it can be referenced by
    // nothing, so it is dropped rather than carried around half-built.
    private named<T extends { name?: string }>(entries: T[] | undefined): (T & { name: string })[] {
        return (entries ?? []).filter((entry): entry is T & { name: string } => !!entry?.name)
    }

    private byName<T extends { name: string }>(entities: T[]): Map<string, T> {
        return new Map(entities.map(entity => [entity.name, entity]))
    }

    // kubectl resolves a relative reference against the folder of the kubeconfig
    // that names it, not against the working directory.
    private resolve(path: string): string {
        if (KubeconfigEntityQuery.AbsolutePath.test(path)) {
            return path
        }

        const separator = Math.max(this.file.lastIndexOf('/'), this.file.lastIndexOf('\\'))
        if (separator < 0) {
            return path
        }

        return `${this.file.slice(0, separator)}/${path}`
    }

    private get file(): string {
        const file = this.options?.file
        if (!file) {
            throw new Error('KubeconfigEntityQuery needs a file — ask the context for one with forFile(path)')
        }
        return file
    }
}
