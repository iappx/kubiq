import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import type { THelmEnvironment } from '@/domain/models/helm/types/THelmEnvironment'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'

export abstract class HelmInvocationBase {
    constructor(
        protected readonly environment: THelmEnvironment,
        protected readonly processes: ProcessAdapter,
    ) {}

    public get target(): THelmEnvironment {
        return this.environment
    }

    public argsOf(args: readonly string[]): string[] {
        return [...args, ...HelmCommand.context(this.environment.contextName)]
    }

    public env(): Record<string, string> {
        return { [HelmCommand.kubeconfigVariable]: this.environment.kubeconfig }
    }
}
