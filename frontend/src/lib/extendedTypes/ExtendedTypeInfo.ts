import { Uuid } from '@/lib/uuid/Uuid'

export class ExtendedTypeInfo {
    public readonly guid: string

    private readonly metadata: Record<string, any>
    private readonly propertyMeta: Record<string, any>

    constructor() {
        this.guid = Uuid.v4()
        this.propertyMeta = {}
        this.metadata = {}
    }

    public setMeta<T>(key: string, data: T): void {
        this.metadata[key] = data
    }

    public setPropertyMeta<T>(key: string, property: string, data: T): void {
        this.declareProperty(property)
        this.propertyMeta[property][key] = data
    }

    public getMeta<T>(key: string): T {
        return this.metadata[key] || null
    }

    public getPropertyMeta<T>(key: string, property: string): T | null {
        if (this.propertyMeta[property] && this.propertyMeta[property][key]) {
            return this.propertyMeta[property][key]
        }
        return null
    }

    public declareProperty(propertyKey: string): void {
        if (!this.propertyMeta[propertyKey]) {
            this.propertyMeta[propertyKey] = {}
        }
    }

    public getDeclaredProperties(): string[] {
        return Object.keys(this.propertyMeta)
    }

    public getFullPropertyMeta<T>(key: string): Record<string, T> {
        const properties = this.getDeclaredProperties()
        const result: Record<string, any> = {}
        for (let i = 0; i < properties.length; i++) {
            const property = properties[i]
            const meta = this.getPropertyMeta(key, property)
            if (meta !== null) {
                result[property] = this.getPropertyMeta(key, property)
            }
        }
        return result
    }
}
