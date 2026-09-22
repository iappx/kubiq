import type { TPodEnvironmentSource } from '@/application/services/podEnvironment/types/TPodEnvironmentSource'
import { KubeDataMapReader } from '@/domain/entities/config'
import { PodEnvironmentPlan } from '@/domain/entities/workloads'
import type { TPodEnvironmentObjectRef } from '@/domain/entities/workloads'

export class PodEnvironmentSources {
    private readonly known = new Map<string, TPodEnvironmentSource>()

    public remember(object: TPodEnvironmentObjectRef, source: TPodEnvironmentSource): void {
        this.known.set(PodEnvironmentPlan.keyOf(object), source)
    }

    public of(object: TPodEnvironmentObjectRef): TPodEnvironmentSource {
        return this.known.get(PodEnvironmentPlan.keyOf(object)) ?? { state: 'missing', data: {}, encoded: false }
    }

    public keysOf(object: TPodEnvironmentObjectRef): string[] {
        return KubeDataMapReader.keysOf(this.of(object).data)
    }

    public has(object: TPodEnvironmentObjectRef, key: string): boolean {
        return this.keysOf(object).includes(key)
    }

    public valueOf(object: TPodEnvironmentObjectRef, key: string): string {
        const source = this.of(object)

        return source.encoded
            ? KubeDataMapReader.decode(source.data, key)
            : KubeDataMapReader.plain(source.data, key)
    }

    public get size(): number {
        return this.known.size
    }
}
