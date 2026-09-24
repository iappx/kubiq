import { inject, injectable } from 'tsyringe'
import type { TKubeconfigProblem } from '@/application/services/kubeconfig/types/TKubeconfigProblem'
import type { TKubeconfigRead } from '@/application/services/kubeconfig/types/TKubeconfigRead'
import type { TKubeconfigScan } from '@/application/services/kubeconfig/types/TKubeconfigScan'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import { KubeconfigClusterEntity } from '@/domain/entities/kubeconfig/KubeconfigClusterEntity'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import { KubeconfigFileEntity } from '@/domain/entities/kubeconfig/KubeconfigFileEntity'
import { KubeconfigUserEntity } from '@/domain/entities/kubeconfig/KubeconfigUserEntity'
import type { TConnectionSpec } from '@/domain/entities/kubeconfig/types/TConnectionSpec'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeconfigEntityQuery } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityQuery'
import { KubeconfigFileQuery } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigFileQuery'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { Base64 } from '@/lib/encoding/Base64'

@injectable()
export class KubeconfigService {
    private static readonly PathVariable = 'KUBECONFIG'

    private static readonly DefaultFolder = '.kube'

    constructor(
        @inject(EnvironmentAdapter) private readonly environment: EnvironmentAdapter,
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
    ) {}

    public resolve(path: string): Promise<string> {
        return this.expand(path)
    }

    public async locate(extraPaths: readonly string[] = []): Promise<string[]> {
        return (await this.scan(extraPaths)).files
    }

    public async read(extraPaths: readonly string[] = []): Promise<TKubeconfigRead> {
        const scan = await this.scan(extraPaths)
        const problems = [...scan.problems]
        const clusters = new Map<string, KubeconfigClusterEntity>()
        const users = new Map<string, KubeconfigUserEntity>()
        const contexts = new Map<string, KubeconfigContextEntity>()
        let currentContextName = ''

        // kubectl merges each section on its own and keeps the first entry of a
        // name, so a context may well name a cluster declared in a later file.
        for (const file of scan.files) {
            const query = this.query(file)

            try {
                const fileClusters = await query.getClusters()
                const fileUsers = await query.getUsers()
                const fileContexts = await query.getAll()
                const current = await query.getCurrentContextName()

                this.keepFirst(clusters, fileClusters)
                this.keepFirst(users, fileUsers)
                this.keepFirst(contexts, fileContexts)
                currentContextName ||= current
            } catch (err) {
                problems.push(this.problemOf(file, err))
            }
        }

        return {
            files: scan.files,
            contexts: [...contexts.values()].map(context => this.bind(context, clusters, users)),
            currentContextName,
            problems,
        }
    }

    public async getContexts(extraPaths: readonly string[] = []): Promise<KubeconfigContextEntity[]> {
        return (await this.read(extraPaths)).contexts
    }

    public async getCurrentContextName(extraPaths: readonly string[] = []): Promise<string> {
        return (await this.read(extraPaths)).currentContextName
    }

    public async fingerprint(extraPaths: readonly string[] = []): Promise<string> {
        const stamps: string[] = []

        for (const path of await this.named(extraPaths)) {
            const entry = await this.files.getById(path)

            if (entry?.isDirectory) {
                stamps.push(...(await this.candidatesIn(path)).map(candidate => candidate.stamp))
            } else {
                stamps.push(entry?.stamp ?? `${path}|absent`)
            }
        }

        const home = await this.homeFolder()
        if (home) {
            stamps.push(...(await this.candidatesIn(home)).map(candidate => candidate.stamp))
        }

        return stamps.join('\n')
    }

    public async buildConnectionSpec(contextName: string, extraPaths: readonly string[] = []): Promise<TConnectionSpec> {
        const read = await this.read(extraPaths)
        const context = read.contexts.find(candidate => candidate.name === contextName)

        if (!context) {
            throw new ApiError(
                `Kubeconfig context "${contextName}" was not found`,
                `Files read: ${read.files.join(', ') || 'none'}`,
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

    private async scan(extraPaths: readonly string[]): Promise<TKubeconfigScan> {
        const files: string[] = []
        const folders: string[] = []
        const problems: TKubeconfigProblem[] = []

        for (const path of await this.named(extraPaths)) {
            const entry = await this.files.getById(path)
            if (entry?.isDirectory) {
                folders.push(path)
            } else {
                files.push(path)
            }
        }

        const home = await this.homeFolder()
        if (home) {
            folders.push(home)
        }

        for (const folder of new Set(folders)) {
            for (const candidate of await this.candidatesIn(folder)) {
                if (files.includes(candidate.path)) {
                    continue
                }

                try {
                    if (await this.query(candidate.path).isKubeconfig()) {
                        files.push(candidate.path)
                    }
                } catch (err) {
                    problems.push(this.problemOf(candidate.path, err))
                }
            }
        }

        return { files, problems }
    }

    private async named(extraPaths: readonly string[]): Promise<string[]> {
        const variable = (await this.environment.get(KubeconfigService.PathVariable)).trim()
        const paths = await this.expandAll(extraPaths)

        if (variable) {
            paths.push(...await this.split(variable))
        }

        return [...new Set(paths)]
    }

    private async homeFolder(): Promise<string> {
        const home = await this.environment.homeDir()

        return home ? `${home.replace(/[\\/]+$/, '')}/${KubeconfigService.DefaultFolder}` : ''
    }

    private async candidatesIn(folder: string): Promise<KubeconfigFileEntity[]> {
        const entries = await this.repoProvider.kubeconfig.inFolder(folder).getAll()

        // kubectl's own file goes first, so its entries win a name clash.
        return entries
            .filter(entry => entry.isCandidate)
            .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name))
    }

    private problemOf(file: string, err: unknown): TKubeconfigProblem {
        if (!(err instanceof ApiError)) {
            throw err
        }

        return { path: file, message: err.message, details: err.details ?? '' }
    }

    private async expandAll(paths: readonly string[]): Promise<string[]> {
        const expanded: string[] = []

        for (const path of paths) {
            const value = await this.expand(path)
            if (value) {
                expanded.push(value)
            }
        }

        return expanded
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

    private get files(): KubeconfigFileQuery {
        return this.repoProvider.kubeconfig.files
    }
}
