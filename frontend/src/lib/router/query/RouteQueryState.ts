import { watch } from 'vue'
import type { WatchStopHandle } from 'vue'
import type { LocationQuery, LocationQueryValue, Router } from 'vue-router'
import type { TRouteQueryField } from '@/lib/router/query/types/TRouteQueryField'

export class RouteQueryState {
    private readonly fields: readonly TRouteQueryField[]

    private stopWatching: WatchStopHandle | null = null

    private stopListening: (() => void) | null = null

    private queued: Promise<void> | null = null

    private pending = false

    constructor(private readonly router: Router, fields: readonly TRouteQueryField[]) {
        this.fields = [...fields]
    }

    public start(): void {
        if (this.stopWatching !== null) {
            return
        }

        this.stopListening = this.router.afterEach(() => this.apply())
        // Sync flush: the coalescing is this class's own and must not shift with Vue's scheduler.
        this.stopWatching = watch(() => this.snapshot(), () => this.schedule(), { flush: 'sync' })
        this.apply()
    }

    public stop(): void {
        if (this.stopWatching !== null) {
            this.stopWatching()
            this.stopWatching = null
        }
        if (this.stopListening !== null) {
            this.stopListening()
            this.stopListening = null
        }
    }

    public settled(): Promise<void> {
        return this.queued ?? Promise.resolve()
    }

    public apply(): void {
        const query = this.router.currentRoute.value.query

        this.fields.forEach((field) => {
            const raw = RouteQueryState.text(query[field.key])
            const value = raw ?? RouteQueryState.fallback(field)

            if (field.read() !== value) {
                field.write(value)
            }
        })

        // A field may refuse what it was handed, or read back something the address never said;
        // this is what settles that, and it writes nothing when there is nothing to settle.
        this.schedule()
    }

    private schedule(): void {
        if (this.queued !== null) {
            this.pending = true

            return
        }

        this.queued = this.flush()
    }

    private async flush(): Promise<void> {
        try {
            do {
                this.pending = false
                await Promise.resolve()
                await this.write()
            } while (this.pending)
        } finally {
            this.queued = null
        }
    }

    private write(): Promise<void> {
        if (this.stopWatching === null) {
            return Promise.resolve()
        }

        const route = this.router.currentRoute.value
        const next = this.nextQuery(route.query)

        if (next === null) {
            return Promise.resolve()
        }

        return this.router
            .replace({ path: route.path, query: next, hash: route.hash })
            .then(() => undefined)
    }

    private nextQuery(current: LocationQuery): LocationQuery | null {
        const next: LocationQuery = { ...current }
        let changed = false

        this.fields.forEach((field) => {
            const value = field.read()
            const wanted = value === RouteQueryState.fallback(field) ? null : value

            if (wanted === RouteQueryState.text(current[field.key])) {
                return
            }

            changed = true
            if (wanted === null) {
                delete next[field.key]
            } else {
                next[field.key] = wanted
            }
        })

        return changed ? next : null
    }

    private snapshot(): string {
        return JSON.stringify(this.fields.map(field => field.read()))
    }

    private static fallback(field: TRouteQueryField): string {
        return field.defaultValue ?? ''
    }

    private static text(value: LocationQueryValue | LocationQueryValue[] | undefined): string | null {
        if (Array.isArray(value)) {
            return value.length > 0 ? RouteQueryState.text(value[0]) : null
        }

        return typeof value === 'string' ? value : null
    }
}
