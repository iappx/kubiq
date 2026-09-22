import { ContainerWaitingReasonCatalog } from '@/domain/entities/workloads/ContainerWaitingReasonCatalog'
import type { TKubeContainer } from '@/domain/entities/workloads/types/TKubeContainer'
import type { TKubeContainerStatus } from '@/domain/entities/workloads/types/TKubeContainerStatus'
import type { TPodContainerHealth } from '@/domain/entities/workloads/types/TPodContainerHealth'
import type { TPodSpec } from '@/domain/entities/workloads/types/TPodSpec'
import type { TPodStatus } from '@/domain/entities/workloads/types/TPodStatus'

export class PodContainerHealth {
    public static of(spec: TPodSpec | undefined, status: TPodStatus | undefined): TPodContainerHealth[] {
        return [
            ...PodContainerHealth.group(spec?.initContainers, status?.initContainerStatuses, true),
            ...PodContainerHealth.group(spec?.containers, status?.containerStatuses, false),
        ]
    }

    private static group(
        containers: TKubeContainer[] | undefined,
        statuses: TKubeContainerStatus[] | undefined,
        isInit: boolean,
    ): TPodContainerHealth[] {
        const reported = PodContainerHealth.byName(statuses)

        return (containers ?? []).map(container => PodContainerHealth.describe(
            container.name,
            reported[container.name],
            isInit,
        ))
    }

    private static byName(statuses: TKubeContainerStatus[] | undefined): Record<string, TKubeContainerStatus> {
        const reported: Record<string, TKubeContainerStatus> = {}

        for (const status of statuses ?? []) {
            reported[status.name] = status
        }

        return reported
    }

    private static describe(
        name: string,
        status: TKubeContainerStatus | undefined,
        isInit: boolean,
    ): TPodContainerHealth {
        if (!status) {
            return { name, isInit, state: 'unknown', statusTitle: 'Not started' }
        }

        if (status.state?.running) {
            return status.ready === true
                ? { name, isInit, state: 'ok', statusTitle: 'Running' }
                : { name, isInit, state: 'warning', statusTitle: 'Running (not ready)' }
        }

        const waiting = status.state?.waiting
        if (waiting) {
            const reason = waiting.reason ?? ''

            return {
                name,
                isInit,
                state: reason !== '' && ContainerWaitingReasonCatalog.isError(reason) ? 'error' : 'warning',
                statusTitle: reason !== '' ? reason : 'Waiting',
            }
        }

        const terminated = status.state?.terminated
        if (terminated) {
            const exitCode = terminated.exitCode ?? 0
            const reason = terminated.reason ?? 'Terminated'

            return {
                name,
                isInit,
                state: exitCode === 0 ? 'ok' : 'error',
                statusTitle: exitCode === 0 ? reason : `${reason} (exit ${exitCode})`,
            }
        }

        return { name, isInit, state: 'unknown', statusTitle: 'Unknown' }
    }
}
