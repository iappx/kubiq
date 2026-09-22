import type { TDetailContainer } from '@/components/resource/detail/types/TDetailContainer'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { PodSpecReader } from '@/domain/entities/workloads'
import { KubeManifest } from '@/domain/models/kube'

export class DetailContainers {
    public static of(object: Record<string, unknown>): TDetailContainer[] {
        const spec = PodSpecReader.of(object)
        const statuses = DetailContainers.statuses(object)

        return [
            ...DetailContainers.list(spec.initContainers),
            ...DetailContainers.list(spec.containers),
        ].map(container => DetailContainers.describe(container, statuses))
    }

    private static statuses(object: Record<string, unknown>): Record<string, Record<string, unknown>> {
        const status = KubeManifest.isObject(object.status) ? object.status : {}
        const all = [
            ...(Array.isArray(status.initContainerStatuses) ? status.initContainerStatuses : []),
            ...(Array.isArray(status.containerStatuses) ? status.containerStatuses : []),
        ]

        const byName: Record<string, Record<string, unknown>> = {}
        all.filter(entry => KubeManifest.isObject(entry)).forEach((entry) => {
            const name = DetailContainers.text((entry as Record<string, unknown>).name)
            if (name !== '') {
                byName[name] = entry as Record<string, unknown>
            }
        })

        return byName
    }

    private static list(value: unknown): Record<string, unknown>[] {
        return Array.isArray(value)
            ? value.filter((entry): entry is Record<string, unknown> => KubeManifest.isObject(entry))
            : []
    }

    private static describe(
        container: Record<string, unknown>,
        statuses: Record<string, Record<string, unknown>>,
    ): TDetailContainer {
        const name = DetailContainers.text(container.name)
        const status = statuses[name]
        if (!status) {
            return {
                name,
                image: DetailContainers.text(container.image),
                state: 'Not started',
                restarts: 0,
                tone: 'unknown',
                detail: '',
            }
        }

        const state = DetailContainers.stateOf(status)

        return {
            name,
            image: DetailContainers.text(container.image),
            state: state.label,
            restarts: typeof status.restartCount === 'number' ? status.restartCount : 0,
            tone: state.tone,
            detail: state.detail,
        }
    }

    private static stateOf(status: Record<string, unknown>): { label: string; tone: TUiTone; detail: string } {
        const state = KubeManifest.isObject(status.state) ? status.state : {}

        if (KubeManifest.isObject(state.running)) {
            return status.ready === true
                ? { label: 'Running', tone: 'ok', detail: '' }
                : { label: 'Running', tone: 'warning', detail: 'Not ready' }
        }

        if (KubeManifest.isObject(state.waiting)) {
            const reason = DetailContainers.text(state.waiting.reason) || 'Waiting'

            return { label: reason, tone: 'warning', detail: DetailContainers.text(state.waiting.message) }
        }

        if (KubeManifest.isObject(state.terminated)) {
            const exit = state.terminated.exitCode
            const clean = exit === 0

            return {
                label: DetailContainers.text(state.terminated.reason) || 'Terminated',
                tone: clean ? 'ok' : 'error',
                detail: typeof exit === 'number' ? `Exit code ${exit}` : '',
            }
        }

        return { label: 'Unknown', tone: 'unknown', detail: '' }
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}
