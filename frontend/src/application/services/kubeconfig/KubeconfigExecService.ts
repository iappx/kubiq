import { inject, singleton } from 'tsyringe'
import { ExecCredentialParser } from '@/application/services/kubeconfig/models/ExecCredentialParser'
import type { TExecCredential } from '@/application/services/kubeconfig/types/TExecCredential'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import type { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import { ApiError } from '@/domain/errors/ApiError'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { ProcessCollector } from '@/infrastructure/process/ProcessCollector'

@singleton()
export class KubeconfigExecService {
    public static readonly ExpirySkewMs: number = 60_000

    public static readonly DefaultTimeoutMs: number = 30_000

    private static readonly AbsolutePath: RegExp = /^([a-zA-Z]:[\\/]|[\\/])/

    private static readonly LeadingRelativePrefix: RegExp = /^\.[\\/]/

    private readonly cache = new Map<string, { contextName: string; credential: TExecCredential }>()

    constructor(
        @inject(ProcessAdapter) private readonly processAdapter: ProcessAdapter,
        @inject(EnvironmentAdapter) private readonly environment: EnvironmentAdapter,
    ) {}

    public async resolve(context: KubeconfigContextEntity): Promise<TExecCredential> {
        const user = context.user
        const execConfig = user?.execConfig

        if (!user || !execConfig || !execConfig.command.trim()) {
            throw new ApiError(
                `Kubeconfig context "${context.name}" has an incomplete exec credential configuration`,
            )
        }

        if (execConfig.interactiveMode === KubeconfigAuthTypeCatalog.InteractiveExecMode) {
            throw new ApiError(
                `Kubeconfig context "${context.name}" cannot be used: ${KubeconfigAuthTypeCatalog.InteractiveExecReason}`,
            )
        }

        const key = `${context.filePath}|${context.name}|${user.name}`
        const cached = this.cachedOf(key)
        if (cached) {
            return cached
        }

        const command = await this.resolveCommand(execConfig.command.trim(), user.filePath || context.filePath)
        const env: Record<string, string> = {}
        for (const entry of execConfig.env) {
            env[entry.name] = entry.value
        }
        env.KUBERNETES_EXEC_INFO = ExecCredentialParser.buildExecInfo(execConfig, context.cluster)

        let outcome
        try {
            outcome = await this.processAdapter.collect({
                command,
                args: execConfig.args,
                env,
                timeoutMs: KubeconfigExecService.DefaultTimeoutMs,
            })
        } catch (err) {
            if (err instanceof ApiError && execConfig.installHint.trim() !== '') {
                throw new ApiError(
                    err.message,
                    KubeconfigExecService.joinDetails(err.details, execConfig.installHint),
                )
            }
            throw err
        }

        if (outcome.code === ProcessAdapter.unavailableCode) {
            throw new ApiError(
                'Exec credential plugins need the desktop application',
                'The Wails runtime is not available',
            )
        }

        if (outcome.code === ProcessCollector.expiredCode) {
            throw new ApiError(
                `Exec credential plugin "${execConfig.command}" timed out`,
                execConfig.installHint.trim() || undefined,
            )
        }

        if (outcome.code !== 0) {
            const detail = KubeconfigExecService.joinDetails(
                ExecCredentialParser.sanitizeStderr(outcome.stderr),
                execConfig.installHint,
            )
            throw new ApiError(
                `Exec credential plugin "${execConfig.command}" exited with code ${outcome.code}`,
                detail || undefined,
            )
        }

        const credential = ExecCredentialParser.parse(outcome.stdout)

        if (credential.expiresAt > Date.now() + KubeconfigExecService.ExpirySkewMs) {
            this.cache.set(key, { contextName: context.name, credential })
        }

        return credential
    }

    public forget(contextName?: string): void {
        if (contextName === undefined) {
            this.cache.clear()
            return
        }

        for (const [key, entry] of this.cache.entries()) {
            if (entry.contextName === contextName) {
                this.cache.delete(key)
            }
        }
    }

    private cachedOf(key: string): TExecCredential | null {
        const entry = this.cache.get(key)
        if (!entry) {
            return null
        }

        if (entry.credential.expiresAt === 0 || Date.now() < entry.credential.expiresAt - KubeconfigExecService.ExpirySkewMs) {
            return entry.credential
        }

        this.cache.delete(key)
        return null
    }

    private async resolveCommand(raw: string, baseFile: string): Promise<string> {
        if (raw.startsWith('~')) {
            return await this.environment.expand(raw) || raw
        }

        if (!raw.includes('/') && !raw.includes('\\')) {
            return raw
        }

        if (KubeconfigExecService.AbsolutePath.test(raw)) {
            return raw
        }

        const separator = Math.max(baseFile.lastIndexOf('/'), baseFile.lastIndexOf('\\'))
        if (separator < 0) {
            return raw
        }

        const relative = raw.replace(KubeconfigExecService.LeadingRelativePrefix, '')
        return `${baseFile.slice(0, separator)}/${relative}`
    }

    private static joinDetails(first: string | undefined, second: string | undefined): string {
        return [first?.trim() ?? '', second?.trim() ?? ''].filter(part => part !== '').join('\n')
    }
}
