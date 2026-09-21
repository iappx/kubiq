export abstract class StorageBase<T> {
    public data: Record<string, T> = {}

    addOrUpdate(key: string, item: Partial<T>): Partial<T> {
        if (!this.data[key]) {
            this.data[key] = item as T
        } else {
            this.data[key] = { ...this.data[key], ...item }
        }
        return this.data[key]
    }

    getAsArray(): T[] {
        return Object.values(this.data)
    }
}