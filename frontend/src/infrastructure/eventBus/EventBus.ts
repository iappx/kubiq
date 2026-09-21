import mitt, { Emitter } from 'mitt'
import { singleton } from 'tsyringe'
import { Constructor } from '@/lib/types/Constructor'
import { TypeIdentity } from '@/lib/extendedTypes/TypeIdentity'

export type EventHandler<T> = (event: T) => Promise<void> | void

@singleton()
export class EventBus {
    private readonly emitter: Emitter<any>

    public constructor() {
        this.emitter = mitt()
    }

    public registerHandler<T>(event: Constructor<T>, handler: EventHandler<T>): void {
        this.emitter.on(TypeIdentity.guid(event), handler)
    }

    public unregisterHandler<T>(event: Constructor<T>, handler: EventHandler<T>): void {
        this.emitter.off(TypeIdentity.guid(event), handler)
    }

    public emitEvent<T extends object>(event: T): void {
        this.emitter.emit(TypeIdentity.guid(event.constructor), event)
    }
}
