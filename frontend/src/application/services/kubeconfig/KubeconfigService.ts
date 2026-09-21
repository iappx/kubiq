import { inject, injectable } from 'tsyringe'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import { KubeconfigClusterEntity } from '@/domain/entities/kubeconfig/KubeconfigClusterEntity'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import { KubeconfigUserEntity } from '@/domain/entities/kubeconfig/KubeconfigUserEntity'
import type { TConnectionSpec } from '@/domain/entities/kubeconfig/types/TConnectionSpec'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeconfigEntityQuery } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityQuery'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { Base64 } from '@/lib/encoding/Base64'

@injectable()
export class KubeconfigService {
    private static readonly PathVariable = 'KUBECONFIG'

    private static readonly DefaultFile = '.kube/config'

    constructor(
        @inject(EnvironmentAdapter) private readonly environment: EnvironmentAdapter,
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
    ) {}

    public async locate(extraPath?: string): Promise<string[]> {
        const extra = await this.expand(extraPath)
        const found = extra ? [extra, ...await this.discover()] : await this.discover()

        return [...new Set(found)]
    }

    public async getContexts(extraPath?: string): Promise<KubeconfigContextEntity[]> {
        const files = await this.locate(extraPath)
        const clusters = new Map<string, KubeconfigClusterEntity>()
        const users = new Map<string, KubeconfigUserEntity>()
        const contexts = new Map<string, KubeconfigContextEntity>()

        // kubectl merges each section on its own and keeps the first entry of a
        // name, so a context may well name a cluster declared in a later file.
        for (const file of files) {
            const query = this.query(file)
            this.keepFirst(clusters, await query.getClusters())
            this.keepFirst(users, await query.getUsers())
            this.keepFirst(contexts, await query.getAll())
        }

        return [...contexts.values()].map(context => this.bind(context, clusters, users))
    }

    public async getCurrentContextName(extraPath?: string): Promise<string> {
        const files = await this.locate(extraPath)

        for (const file of files) {
            const name = await this.query(file).getCurrentContextName()
            if (name) {
                return name
            }
        }

        return ''
    }

    public async buildConnectionSpec(contextName: string, extraPath?: string): Promise<TConnectionSpec> {
        const contexts = await this.getContexts(extraPath)
        const context = contexts.find(candidate => candidate.name === contextName)

        if (!context) {
            throw new ApiError(
                `Kubeconfig context "${contextName}" was not found`,
                `Files read: ${(await this.locate(extraPath)).join(', ') || 'none'}`,
            )
        }

        return this.specOf(context)
    }

    private async specOf(context: KubeconfigContextEntity): Promise<TConnectionSpec> {
        const cluster = context.cluster
        const user = context.user

        if (!cluster?.server) {
            throw new ApiError(
                `Kubeconfig context "${context.name}" has no cluster address`,
                `Cluster: ${context.clusterName || 'not set'}`,
            )
        }

        if (user && !user.isSupported) {
            throw new ApiError(
                `Kubeconfig context "${context.name}" cannot be used yet: ${KubeconfigAuthTypeCatalog.reason(user.authType)}`,
                `Authentication method: ${KubeconfigAuthTypeCatalog.title(user.authType)}`,
            )
        }

        return {
            server: cluster.server,
            caPem: await this.material(
                cluster.certificateAuthorityData,
                cluster.certificateAuthority,
                cluster.filePath,
                'certificate-authority-data',
            ),
            clientCertPem: await this.material(
                user?.clientCertificateData,
                user?.clientCertificate,
                user?.filePath,
                'client-certificate-data',
            ),
            clientKeyPem: await this.material(
                user?.clientKeyData,
                user?.clientKey,
                user?.filePath,
                'client-key-data',
            ),
            token: await this.token(user),
            username: user?.username ?? '',
            password: user?.password ?? '',
            insecureSkipTlsVerify: cluster.insecureSkipTlsVerify === true,
            serverName: cluster.tlsServerName ?? '',
            proxyUrl: cluster.proxyUrl ?? '',
            // 0 leaves the request timeout to the Go client.
            timeoutSeconds: 0,
        }
    }

    private async material(
        data: string | undefined,
        path: string | undefined,
        file: string | undefined,
        field: string,
    ): Promise<string> {
        if (data) {
            return this.decode(data, field, file)
        }

        if (path && file) {
            return this.query(file).readCredentialFile(path)
        }

        return ''
    }

    private async token(user: KubeconfigUserEntity | undefined): Promise<string> {
        if (user?.token) {
            return user.token.trim()
        }

        if (user?.tokenFile && user.filePath) {
            const content = await this.query(user.filePath).readCredentialFile(user.tokenFile)
            return content.trim()
        }

        return ''
    }

    private decode(data: string, field: string, file: string | undefined): string {
        try {
            return Base64.b64ToString(data)
        } catch {
            throw new ApiError(
                `The kubeconfig field "${field}" is not valid base64`,
                `File: ${file ?? 'unknown'}`,
            )
        }
    }

    private async discover(): Promise<string[]> {
        const variable = (await this.environment.get(KubeconfigService.PathVariable)).trim()

        if (variable) {
            return this.split(variable)
        }

        const home = await this.environment.homeDir()
        if (!home) {
            return []
        }

        return [`${home.replace(/[\\/]+$/, '')}/${KubeconfigService.DefaultFile}`]
    }

    private async split(variable: string): Promise<string[]> {
        const separator = await this.environment.pathListSeparator()
        const parts = separator ? variable.split(separator) : [variable]
        const paths: string[] = []

        for (const part of parts) {
            const path = await this.expand(part)
            if (path) {
                paths.push(path)
            }
        }

        return paths
    }

    private async expand(path: string | undefined): Promise<string> {
        const value = path?.trim() ?? ''
        if (!value) {
            return ''
        }

        return await this.environment.expand(value) || value
    }

    private keepFirst<T extends { name: string }>(target: Map<string, T>, entities: T[]): void {
        for (const entity of entities) {
            if (!target.has(entity.name)) {
                target.set(entity.name, entity)
            }
        }
    }

    private bind(
        context: KubeconfigContextEntity,
        clusters: Map<string, KubeconfigClusterEntity>,
        users: Map<string, KubeconfigUserEntity>,
    ): KubeconfigContextEntity {
        const cluster = clusters.get(context.clusterName)
        if (cluster) {
            context.cluster = cluster
        }

        const user = users.get(context.userName)
        if (user) {
            context.user = user
        }

        return context
    }

    private query(file: string): KubeconfigEntityQuery {
        return this.repoProvider.kubeconfig.forFile(file)
    }
}
