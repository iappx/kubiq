import { inject, singleton } from 'tsyringe'
import { EnvService } from '../../../bindings/iappx_k8s_admin/core/services/env'
import type { EnvResult } from '../../../bindings/iappx_k8s_admin/core/services/env/models'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class EnvironmentAdapter {
    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public get(name: string): Promise<string> {
        return this.value(() => EnvService.Get(name))
    }

    public homeDir(): Promise<string> {
        return this.value(() => EnvService.UserHomeDir())
    }

    public pathListSeparator(): Promise<string> {
        return this.value(() => EnvService.PathSeparator())
    }

    public expand(path: string): Promise<string> {
        return this.value(() => EnvService.Expand(path))
    }

    private async value(call: () => Promise<EnvResult>): Promise<string> {
        if (!this.runtime.isAvailable()) {
            return ''
        }

        try {
            const result = await call()
            return result.success ? result.value : ''
        } catch {
            return ''
        }
    }
}
