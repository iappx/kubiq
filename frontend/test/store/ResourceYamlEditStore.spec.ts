import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ResourceYamlEditStore } from '@/store/modules/resourceYamlEdit/ResourceYamlEditStore'

const store = container.resolve(ResourceYamlEditStore)

const pod = 'c1|v1/pods|default/api'
const other = 'c1|v1/pods|default/web'

describe('ResourceYamlEditStore', () => {
    beforeEach(() => {
        store.discard()
    })

    it('starts in view mode with nothing to lose', () => {
        expect(store.isEditing(pod)).toBe(false)
        expect(store.hasUnsavedChanges).toBe(false)
    })

    it('edits one object at a time', () => {
        store.begin(pod)
        store.begin(other)

        expect(store.isEditing(pod)).toBe(false)
        expect(store.isEditing(other)).toBe(true)
    })

    it('has unsaved changes only while an edit is dirty', () => {
        store.begin(pod)
        expect(store.hasUnsavedChanges).toBe(false)

        store.setDirty(pod, true)
        expect(store.hasUnsavedChanges).toBe(true)

        store.setDirty(pod, false)
        expect(store.hasUnsavedChanges).toBe(false)
    })

    it('ignores dirt reported by an object that is not being edited', () => {
        store.begin(pod)
        store.setDirty(other, true)

        expect(store.hasUnsavedChanges).toBe(false)
    })

    it('keeps the dirt when the object already being edited is asked to edit again', () => {
        store.begin(pod)
        store.setDirty(pod, true)
        store.begin(pod)

        expect(store.hasUnsavedChanges).toBe(true)
    })

    it('hands a request to the object it names and consumes it on begin', () => {
        store.request(pod)

        expect(store.isRequested(pod)).toBe(true)
        expect(store.isRequested(other)).toBe(false)

        store.begin(pod)
        expect(store.isRequested(pod)).toBe(false)
    })

    it('ends only the edit of the object that asks', () => {
        store.begin(pod)
        store.setDirty(pod, true)

        store.end(other)
        expect(store.hasUnsavedChanges).toBe(true)

        store.end(pod)
        expect(store.isEditing(pod)).toBe(false)
        expect(store.hasUnsavedChanges).toBe(false)
    })

    it('drops the edit and any pending request on discard', () => {
        store.begin(pod)
        store.setDirty(pod, true)
        store.request(other)

        store.discard()

        expect(store.isEditing(pod)).toBe(false)
        expect(store.isRequested(other)).toBe(false)
        expect(store.hasUnsavedChanges).toBe(false)
    })
})
