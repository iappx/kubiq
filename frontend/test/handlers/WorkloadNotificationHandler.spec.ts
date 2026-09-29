import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { WorkloadNotificationHandler } from '@/application/handlers/workload/WorkloadNotificationHandler'
import { CronJobSuspendedEvent } from '@/domain/events/cluster/CronJobSuspendedEvent'
import { CronJobTriggeredEvent } from '@/domain/events/cluster/CronJobTriggeredEvent'
import { OpenClusterObjectEvent } from '@/domain/events/cluster/OpenClusterObjectEvent'
import { ResourceDeletedEvent } from '@/domain/events/cluster/ResourceDeletedEvent'
import { WorkloadRestartedEvent } from '@/domain/events/cluster/WorkloadRestartedEvent'
import { WorkloadScaledEvent } from '@/domain/events/cluster/WorkloadScaledEvent'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'

container.resolve(WorkloadNotificationHandler)
const eventBus = container.resolve(EventBus)
const toastStore = container.resolve(ToastStore)

const jobs = KubeResourceRegistry.find('batch', 'jobs')!

const opened: OpenClusterObjectEvent[] = []
eventBus.registerHandler(OpenClusterObjectEvent, (event) => {
    opened.push(event)
})

const last = () => toastStore.items[toastStore.items.length - 1]

describe('WorkloadNotificationHandler', () => {
    beforeEach(() => {
        toastStore.items = []
        opened.length = 0
    })

    it('names the object and the new count when a workload is scaled', () => {
        eventBus.emitEvent(new WorkloadScaledEvent('prod', 'Deployment', 'api', 'payments', 3))

        expect(last()).toMatchObject({ type: 'success', message: 'Scaled Deployment payments/api to 3 replicas' })
    })

    it('says one replica rather than one replicas', () => {
        eventBus.emitEvent(new WorkloadScaledEvent('prod', 'Deployment', 'api', 'payments', 1))

        expect(last().message).toBe('Scaled Deployment payments/api to 1 replica')
    })

    it('acknowledges a rollout restart and says what to expect', () => {
        eventBus.emitEvent(new WorkloadRestartedEvent('prod', 'DaemonSet', 'fluentd', 'logging'))

        expect(last()).toMatchObject({
            type: 'success',
            message: 'Restarted the rollout of DaemonSet logging/fluentd',
        })
        expect(last().description).toContain('replaced by the controller')
    })

    it('names the job a manual cron run created', () => {
        eventBus.emitEvent(new CronJobTriggeredEvent('prod', 'nightly', 'payments', 'nightly-x7k2p', jobs))

        expect(last().message).toBe('Job nightly-x7k2p created')
        expect(last().description).toBe('Triggered from CronJob payments/nightly')
    })

    it('offers to open the created job, in its namespace and cluster', () => {
        eventBus.emitEvent(new CronJobTriggeredEvent('prod', 'nightly', 'payments', 'nightly-x7k2p', jobs))

        last().action?.run()

        expect(opened).toEqual([new OpenClusterObjectEvent('prod', jobs, 'payments', 'nightly-x7k2p')])
    })

    it('offers nothing to open when the cluster named no job', () => {
        eventBus.emitEvent(new CronJobTriggeredEvent('prod', 'nightly', 'payments', '', jobs))

        expect(last().message).toBe('Triggered CronJob payments/nightly')
        expect(last().description).toBeUndefined()
        expect(last().action).toBeUndefined()
    })

    it('acknowledges a suspend and says what it stops', () => {
        eventBus.emitEvent(new CronJobSuspendedEvent('prod', 'nightly', 'payments', true))

        expect(last()).toMatchObject({ type: 'success', message: 'Suspended CronJob payments/nightly' })
        expect(last().description).toContain('No new jobs')
    })

    it('acknowledges a resume', () => {
        eventBus.emitEvent(new CronJobSuspendedEvent('prod', 'nightly', 'payments', false))

        expect(last().message).toBe('Resumed CronJob payments/nightly')
    })

    it('acknowledges a delete', () => {
        eventBus.emitEvent(new ResourceDeletedEvent('prod', 'Pod', 'api-0', 'payments'))

        expect(last().message).toBe('Deleted Pod payments/api-0')
    })

    it('leaves the namespace out for a cluster-scoped object', () => {
        eventBus.emitEvent(new ResourceDeletedEvent('prod', 'Node', 'node-a', ''))

        expect(last().message).toBe('Deleted Node node-a')
    })
})
