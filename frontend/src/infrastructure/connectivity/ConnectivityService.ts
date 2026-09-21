import { inject, singleton } from 'tsyringe'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { AppResumedEvent } from '@/domain/events/app/AppResumedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ConnectivityLimits } from '@/infrastructure/connectivity/constants/ConnectivityLimits'

@singleton()
export class ConnectivityService {
    private timer: ReturnType<typeof setInterval> | null = null

    private beatAt: number = 0

    private online: boolean = true

    private onOnline!: () => void

    private onOffline!: () => void

    private onVisibility!: () => void

    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {}

    public get isOnline(): boolean {
        return this.online
    }

    public start(): void {
        if (this.timer !== null || typeof window === 'undefined') {
            return
        }

        this.online = navigator.onLine !== false
        this.beatAt = Date.now()

        this.onOnline = () => this.setOnline(true)
        this.onOffline = () => this.setOnline(false)
        this.onVisibility = () => this.checkGap()

        window.addEventListener('online', this.onOnline)
        window.addEventListener('offline', this.onOffline)
        document.addEventListener('visibilitychange', this.onVisibility)

        this.timer = setInterval(() => this.checkGap(), ConnectivityLimits.heartbeatMs)
    }

    public stop(): void {
        if (this.timer === null) {
            return
        }

        clearInterval(this.timer)
        this.timer = null

        window.removeEventListener('online', this.onOnline)
        window.removeEventListener('offline', this.onOffline)
        document.removeEventListener('visibilitychange', this.onVisibility)
    }

    // Timers do not run while the machine is suspended, so a beat that arrives far later
    // than its period is the only signal the application gets that it has just woken up.
    public checkGap(): void {
        const now = Date.now()
        const elapsed = now - this.beatAt
        this.beatAt = now

        if (elapsed > ConnectivityLimits.heartbeatMs + ConnectivityLimits.sleepToleranceMs) {
            this.eventBus.emitEvent(new AppResumedEvent(elapsed))
        }
    }

    private setOnline(online: boolean): void {
        if (this.online === online) {
            return
        }

        this.online = online
        this.beatAt = Date.now()
        this.eventBus.emitEvent(new AppConnectivityEvent(online))
    }
}
