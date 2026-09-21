import type { TKubeStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStatus'
import type { TKubeWatchEvent } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchEvent'

export class KubeWatchEventReader {
    public static readonly expiredCode: number = 410

    public static read(line: string): TKubeWatchEvent | undefined {
        const trimmed = line.trim()
        if (trimmed === '') {
            return undefined
        }

        let frame: { type?: string, object?: Record<string, unknown> }
        try {
            frame = JSON.parse(trimmed)
        } catch {
            return { type: 'error', message: 'The cluster sent a change that could not be read', details: trimmed }
        }

        const object = frame.object
        switch ((frame.type ?? '').toUpperCase()) {
            case 'ADDED':
                return { type: 'added', object }
            case 'MODIFIED':
                return { type: 'modified', object }
            case 'DELETED':
                return { type: 'deleted', object }
            case 'BOOKMARK':
                return { type: 'bookmark', object }
            case 'ERROR':
                return KubeWatchEventReader.failure(object)
            default:
                return { type: 'error', object, message: `The cluster sent an unknown change of type "${frame.type}"` }
        }
    }

    protected static failure(object?: Record<string, unknown>): TKubeWatchEvent {
        const status = object as TKubeStatus | undefined
        const expired = !!status && (status.code === KubeWatchEventReader.expiredCode || status.reason === 'Expired')
        const fallback = expired
            ? 'The change history is no longer available, the list has to be loaded again'
            : 'The cluster reported a problem while watching for changes'

        return {
            type: expired ? 'expired' : 'error',
            object,
            message: status && status.message ? status.message : fallback,
            details: status ? status.reason : undefined,
        }
    }
}
