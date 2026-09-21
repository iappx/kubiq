import type { TEventType } from '@/domain/entities/cluster/types/TEventType'

export class EventTypeCatalog {
    public static readonly values: Record<TEventType, string> = {
        Normal: 'Normal',
        Warning: 'Warning',
    }

    public static title(type: TEventType): string {
        return EventTypeCatalog.values[type] ?? type
    }

    public static has(type: string): boolean {
        return Object.prototype.hasOwnProperty.call(EventTypeCatalog.values, type)
    }
}
