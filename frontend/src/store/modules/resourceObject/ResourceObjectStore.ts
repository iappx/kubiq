import { inject } from 'tsyringe'
import { PodEnvironmentService } from '@/application/services/podEnvironment/PodEnvironmentService'
import { PodEnvironmentText } from '@/application/services/podEnvironment/models/PodEnvironmentText'
import type { TPodEnvironmentGroup } from '@/application/services/podEnvironment/types/TPodEnvironmentGroup'
import { ResourceDetailService } from '@/application/services/resourceDetail/ResourceDetailService'
import { ResourceEventLog } from '@/application/services/resourceEvents/models/ResourceEventLog'
import { ResourceEventsService } from '@/application/services/resourceEvents/ResourceEventsService'
import type { TObjectEventsRequest } from '@/application/services/resourceEvents/types/TObjectEventsRequest'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import type { TYamlApplyResult } from '@/application/services/resourceYaml/types/TYamlApplyResult'
import type { TYamlCreateRequest } from '@/application/services/resourceYaml/types/TYamlCreateRequest'
import type { TYamlCreateResult } from '@/application/services/resourceYaml/types/TYamlCreateResult'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ResourceAppliedEvent } from '@/domain/events/cluster/ResourceAppliedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeManifest } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { ResourceObjectStateFactory } from '@/store/modules/resourceObject/ResourceObjectStateFactory'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

@InjectableStore
export class ResourceObjectStore extends StoreBase<ResourceObjectStore> {
    public objects: Record<string, TResourceObjectState> = {}

    constructor(
        @inject(ResourceYamlService) private readonly yamlService: ResourceYamlService,
        @inject(ResourceDetailService) private readonly detailService: ResourceDetailService,
        @inject(ResourceEventsService) private readonly eventsService: ResourceEventsService,
        @inject(PodEnvironmentService) private readonly environmentService: PodEnvironmentService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public static keyOf(ref: TResourceObjectRef): string {
        return `${ref.clusterId}|${ref.kind.key}|${ref.namespace}/${ref.name}`
    }

    public stateOf(ref: TResourceObjectRef | null): TResourceObjectState {
        const stored = ref ? this.objects[ResourceObjectStore.keyOf(ref)] : undefined

        return stored ?? ResourceObjectStateFactory.empty()
    }

    public async load(ref: TResourceObjectRef): Promise<void> {
        const key = ResourceObjectStore.keyOf(ref)
        this.patch(key, { loading: true, error: '', errorDetail: '', forbidden: false, missing: false })

        try {
            const object = await this.yamlService.read(ref)
            this.patch(key, { object, loaded: true, conflict: {} })
            await this.loadRelations(ref, object)
        } catch (err) {
            this.rememberFailure(key, err)
        } finally {
            this.patch(key, { loading: false })
        }
    }

    public async apply(ref: TResourceObjectRef, edited: Record<string, unknown>): Promise<TYamlApplyResult | null> {
        const key = ResourceObjectStore.keyOf(ref)
        const current = this.byKey(key).object
        this.patch(key, { applying: true, conflict: {} })

        try {
            const result = await this.yamlService.apply({ ...ref, current, edited })
            this.patch(key, { object: result.object })

            if (result.plan.mode !== 'noop') {
                this.eventBus.emitEvent(new ResourceAppliedEvent(
                    ref.clusterId,
                    ref.kind.kind,
                    ref.name,
                    ref.namespace,
                    result.plan.mode === 'replace',
                ))
            }

            return result
        } catch (err) {
            await this.rememberApplyFailure(key, ref, err)

            return null
        } finally {
            this.patch(key, { applying: false })
        }
    }

    public async create(request: TYamlCreateRequest): Promise<TYamlCreateResult | null> {
        try {
            const created = await this.yamlService.create(request)
            this.eventBus.emitEvent(
                new ResourceCreatedEvent(request.clusterId, request.kind.kind, created.name, created.namespace),
            )

            return created
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ResourceObjectStore.create'))

            return null
        }
    }

    public dismissConflict(ref: TResourceObjectRef): void {
        this.patch(ResourceObjectStore.keyOf(ref), { conflict: {} })
    }

    public takeConflict(ref: TResourceObjectRef): void {
        const key = ResourceObjectStore.keyOf(ref)
        const state = this.byKey(key)
        if (Object.keys(state.conflict).length === 0) {
            return
        }

        this.patch(key, { object: state.conflict, conflict: {} })
    }

    public rebase(ref: TResourceObjectRef, edited: Record<string, unknown>): Record<string, unknown> {
        const fresh = this.byKey(ResourceObjectStore.keyOf(ref)).conflict

        return KubeManifest.withResourceVersion(edited, KubeManifest.resourceVersionOf(fresh))
    }

    // Two runs at once each overwrite the list with their own page and each stop the watch the
    // other just started, so rows blink out and the older page can land last. One run at a time.
    public async loadEvents(ref: TResourceObjectRef): Promise<void> {
        const key = ResourceObjectStore.keyOf(ref)
        if (this.byKey(key).eventsLoading) {
            return
        }

        const request = this.eventsRequest(ref)
        this.patch(key, { eventsLoading: true, eventsError: '' })

        try {
            const result = await this.eventsService.list(request)
            this.patch(key, { events: ResourceEventLog.of(result.items), eventsLoaded: true })

            const watching = await this.eventsService.watch(request, result.cursors, {
                onChanges: changes => this.applyEventChanges(key, changes),
                onResync: () => void this.loadEvents(ref),
                onStale: at => this.patch(key, { eventsWatching: false, eventsStaleSince: at }),
            })

            this.patch(key, { eventsWatching: watching, eventsStaleSince: 0 })
        } catch (err) {
            this.patch(key, {
                eventsLoaded: true,
                eventsWatching: false,
                eventsError: err instanceof ApiError ? err.message : 'The events of this object could not be read',
            })
        } finally {
            this.patch(key, { eventsLoading: false })
        }
    }

    public async stopEvents(ref: TResourceObjectRef): Promise<void> {
        await this.eventsService.stop(this.eventsRequest(ref))
        this.patch(ResourceObjectStore.keyOf(ref), { eventsWatching: false, eventsStaleSince: 0 })
    }

    public async loadEnvironment(ref: TResourceObjectRef): Promise<void> {
        const key = ResourceObjectStore.keyOf(ref)
        if (this.byKey(key).environmentLoading) {
            return
        }

        this.patch(key, { environmentLoading: true, environmentError: '' })

        try {
            const environment = await this.environmentService.describe({
                clusterId: ref.clusterId,
                object: this.byKey(key).object,
                served: ref.served,
            })

            this.patch(key, { environment, environmentLoaded: true })
        } catch (err) {
            this.patch(key, {
                environmentLoaded: true,
                environmentError: err instanceof ApiError
                    ? err.message
                    : 'The environment of this object could not be read',
            })
        } finally {
            this.patch(key, { environmentLoading: false })
        }
    }

    public async copyEnvironmentEntry(ref: TResourceObjectRef, id: string): Promise<boolean> {
        const entry = this.byKey(ResourceObjectStore.keyOf(ref))
            .environment
            .flatMap(group => group.entries)
            .find(candidate => candidate.id === id)

        if (!entry) {
            return false
        }

        try {
            await this.environmentService.copyEntry(entry)
            this.eventBus.emitEvent(new SuccessMessageEvent(
                entry.masked
                    ? `Copied the secret value of ${entry.variable} to the clipboard`
                    : `Copied ${entry.variable} to the clipboard`,
            ))

            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ResourceObjectStore.copyEnvironmentEntry'))

            return false
        }
    }

    public async copyEnvironmentGroup(ref: TResourceObjectRef, container: string): Promise<boolean> {
        const group = this.groupOf(ref, container)
        if (!group) {
            return false
        }

        try {
            const copied = await this.environmentService.copyGroup(group)
            this.eventBus.emitEvent(new SuccessMessageEvent(
                PodEnvironmentText.hidesSecret(group)
                    ? `Copied ${copied} variables of ${container} to the clipboard, secret values included`
                    : `Copied ${copied} variables of ${container} to the clipboard`,
            ))

            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ResourceObjectStore.copyEnvironmentGroup'))

            return false
        }
    }

    public forget(clusterId: string): void {
        const prefix = `${clusterId}|`
        const remaining: Record<string, TResourceObjectState> = {}

        Object.keys(this.objects).forEach((key) => {
            if (!key.startsWith(prefix)) {
                remaining[key] = this.objects[key]
            }
        })

        this.objects = remaining
    }

    private applyEventChanges(key: string, changes: readonly TResourceChange[]): void {
        this.patch(key, { events: ResourceEventLog.apply(this.byKey(key).events, changes) })
    }

    private eventsRequest(ref: TResourceObjectRef): TObjectEventsRequest {
        const object = this.byKey(ResourceObjectStore.keyOf(ref)).object

        return {
            clusterId: ref.clusterId,
            kind: ref.kind,
            name: ref.name,
            namespace: ref.namespace,
            uid: KubeManifest.uidOf(object),
            served: ref.served,
        }
    }

    // Relations are worth having and never worth failing over: the panel shows the object even if its owner cannot be read.
    private async loadRelations(ref: TResourceObjectRef, object: Record<string, unknown>): Promise<void> {
        const key = ResourceObjectStore.keyOf(ref)
        this.patch(key, { relationsLoading: true })

        try {
            const relations = await this.detailService.relations({
                clusterId: ref.clusterId,
                kind: ref.kind,
                object,
                served: ref.served,
            })

            this.patch(key, { relations })
        } catch {
            this.patch(key, { relations: [] })
        } finally {
            this.patch(key, { relationsLoading: false })
        }
    }

    // A conflict raises no error event: the editor puts the fresh object beside the draft and explains it there.
    private async rememberApplyFailure(key: string, ref: TResourceObjectRef, err: unknown): Promise<void> {
        if (!KubeStatusReader.isConflict(err)) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ResourceObjectStore.apply'))

            return
        }

        try {
            this.patch(key, { conflict: await this.yamlService.read(ref) })
        } catch {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ResourceObjectStore.apply'))
        }
    }

    private rememberFailure(key: string, err: unknown): void {
        this.patch(key, {
            error: err instanceof ApiError ? err.message : 'The object could not be read',
            errorDetail: err instanceof ApiError ? (err.details ?? '') : String(err),
            forbidden: KubeStatusReader.isForbidden(err),
            missing: KubeStatusReader.isMissing(err),
        })

        if (!KubeStatusReader.isForbidden(err) && !KubeStatusReader.isMissing(err)) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ResourceObjectStore.load'))
        }
    }

    private groupOf(ref: TResourceObjectRef, container: string): TPodEnvironmentGroup | undefined {
        return this.byKey(ResourceObjectStore.keyOf(ref))
            .environment
            .find(group => group.container === container)
    }

    private byKey(key: string): TResourceObjectState {
        return this.objects[key] ?? ResourceObjectStateFactory.empty()
    }

    private patch(key: string, changes: Partial<TResourceObjectState>): void {
        this.objects = { ...this.objects, [key]: { ...this.byKey(key), ...changes } }
    }
}
