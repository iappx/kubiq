import { PodDebugDefaults } from '@/application/services/podDebug/constants/PodDebugDefaults'
import type { TEphemeralContainerState } from '@/application/services/podDebug/types/TEphemeralContainerState'

export class EphemeralContainerManifest {
    public static nameFor(id: string): string {
        const maxSuffix = PodDebugDefaults.maxNameLength - PodDebugDefaults.containerPrefix.length
        const sanitized = id
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, maxSuffix)
            .replace(/-+$/g, '')

        return `${PodDebugDefaults.containerPrefix}${sanitized || '0'}`
    }

    public static patchPath(namespace: string, podName: string): string {
        return `${EphemeralContainerManifest.podPath(namespace, podName)}/ephemeralcontainers`
    }

    public static podPath(namespace: string, podName: string): string {
        return `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}`
    }

    public static patchDocument(
        containerName: string,
        image: string,
        targetContainerName?: string,
    ): Record<string, unknown> {
        const target = targetContainerName?.trim() ?? ''
        const container: Record<string, unknown> = {
            name: containerName,
            image,
            stdin: true,
            tty: true,
        }
        if (target !== '') {
            container.targetContainerName = target
        }

        return {
            spec: {
                ephemeralContainers: [container],
            },
        }
    }

    public static containerState(pod: Record<string, unknown>, containerName: string): TEphemeralContainerState {
        const state = EphemeralContainerManifest.stateOf(pod, containerName)
        if (!state) {
            return 'waiting'
        }
        if (EphemeralContainerManifest.isRecord(state.running)) {
            return 'running'
        }
        if (EphemeralContainerManifest.isRecord(state.terminated)) {
            return 'terminated'
        }

        return 'waiting'
    }

    public static containerDetail(pod: Record<string, unknown>, containerName: string): string {
        const state = EphemeralContainerManifest.stateOf(pod, containerName)
        if (!state) {
            return ''
        }

        const terminated = EphemeralContainerManifest.isRecord(state.terminated) ? state.terminated : null
        if (terminated) {
            const message = typeof terminated.message === 'string' ? terminated.message.trim() : ''
            const reason = typeof terminated.reason === 'string' ? terminated.reason.trim() : ''
            if (message !== '') {
                return message
            }
            if (reason !== '') {
                return reason
            }
        }

        const waiting = EphemeralContainerManifest.isRecord(state.waiting) ? state.waiting : null
        if (waiting) {
            const message = typeof waiting.message === 'string' ? waiting.message.trim() : ''
            const reason = typeof waiting.reason === 'string' ? waiting.reason.trim() : ''
            if (message !== '') {
                return message
            }
            if (reason !== '') {
                return reason
            }
        }

        return ''
    }

    private static stateOf(pod: Record<string, unknown>, containerName: string): Record<string, unknown> | null {
        const status = EphemeralContainerManifest.isRecord(pod.status) ? pod.status : null
        const list = status?.ephemeralContainerStatuses
        if (!Array.isArray(list)) {
            return null
        }

        const entry = list.find(item => EphemeralContainerManifest.isRecord(item) && item.name === containerName)
        if (!EphemeralContainerManifest.isRecord(entry) || !EphemeralContainerManifest.isRecord(entry.state)) {
            return null
        }

        return entry.state
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value)
    }
}
