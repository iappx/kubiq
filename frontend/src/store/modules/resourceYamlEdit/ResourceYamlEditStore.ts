import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ResourceYamlEditStore extends StoreBase<ResourceYamlEditStore> {
    public editingKey = ''

    public requestedKey = ''

    public dirty = false

    public get hasUnsavedChanges(): boolean {
        return this.editingKey !== '' && this.dirty
    }

    public isEditing(key: string): boolean {
        return key !== '' && this.editingKey === key
    }

    public isRequested(key: string): boolean {
        return key !== '' && this.requestedKey === key
    }

    public request(key: string): void {
        this.requestedKey = key
    }

    public begin(key: string): void {
        if (this.requestedKey === key) {
            this.requestedKey = ''
        }
        if (this.editingKey === key) {
            return
        }

        this.editingKey = key
        this.dirty = false
    }

    public setDirty(key: string, dirty: boolean): void {
        if (this.isEditing(key)) {
            this.dirty = dirty
        }
    }

    public end(key: string): void {
        if (!this.isEditing(key)) {
            return
        }

        this.editingKey = ''
        this.dirty = false
    }

    public discard(): void {
        this.editingKey = ''
        this.requestedKey = ''
        this.dirty = false
    }
}
