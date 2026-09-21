import { singleton } from 'tsyringe'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

@singleton()
export class KubeStreamRegistry {
    private readonly streams = new Map<string, Set<IClusterStream>>()

    public register(clusterId: string, stream: IClusterStream): () => void {
        const open = this.streams.get(clusterId) ?? new Set<IClusterStream>()
        open.add(stream)
        this.streams.set(clusterId, open)

        return () => this.forget(clusterId, stream)
    }

    public forget(clusterId: string, stream: IClusterStream): void {
        const open = this.streams.get(clusterId)
        if (!open) {
            return
        }

        open.delete(stream)
        if (open.size === 0) {
            this.streams.delete(clusterId)
        }
    }

    public count(clusterId: string): number {
        return this.streams.get(clusterId)?.size ?? 0
    }

    public get total(): number {
        let count = 0
        this.streams.forEach(open => {
            count += open.size
        })
        return count
    }

    public async drain(clusterId: string): Promise<number> {
        const open = this.streams.get(clusterId)
        this.streams.delete(clusterId)

        if (!open || open.size === 0) {
            return 0
        }

        const stopped = [...open]
        await Promise.allSettled(stopped.map(stream => stream.stop()))

        return stopped.length
    }

    public async drainAll(): Promise<number> {
        const clusters = [...this.streams.keys()]
        const counts = await Promise.all(clusters.map(clusterId => this.drain(clusterId)))

        return counts.reduce((total, count) => total + count, 0)
    }
}
