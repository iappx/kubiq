import { describe, expect, it } from 'vitest'
import { ArgoSyncValidator } from '@/application/validators/ArgoSyncValidator'
import { ArgoSyncDraftDefaults } from '@/domain/models/argocd'
import type { TArgoSyncDraft } from '@/domain/entities/argocd'

const validator = new ArgoSyncValidator()

const draft = (overrides: Partial<TArgoSyncDraft> = {}): TArgoSyncDraft => ({
    ...ArgoSyncDraftDefaults.blank(),
    ...overrides,
})

describe('ArgoSyncValidator', () => {
    it('accepts an empty revision, which means the one the application tracks', () => {
        expect(validator.validate(draft())).toEqual({ valid: true, errors: {} })
    })

    it('accepts a branch, a tag and a commit', () => {
        expect(validator.validate(draft({ revision: 'main' })).valid).toBe(true)
        expect(validator.validate(draft({ revision: 'v1.2.0' })).valid).toBe(true)
        expect(validator.validate(draft({ revision: '0123456789abcdef' })).valid).toBe(true)
    })

    it('refuses a revision with a space in it', () => {
        const result = validator.validate(draft({ revision: 'release 1' }))

        expect(result.valid).toBe(false)
        expect(result.errors.revision).toBeTruthy()
    })

    it('refuses a revision longer than the field allows', () => {
        const result = validator.validate(draft({ revision: 'a'.repeat(300) }))

        expect(result.valid).toBe(false)
    })

    it('refuses Replace together with apply out-of-sync only, which contradict each other', () => {
        const result = validator.validate(draft({ replace: true, applyOutOfSyncOnly: true }))

        expect(result.valid).toBe(false)
        expect(result.errors.replace).toBeTruthy()
    })

    it('collects every problem in one pass', () => {
        const result = validator.validate(draft({
            revision: 'a b',
            replace: true,
            applyOutOfSyncOnly: true,
        }))

        expect(Object.keys(result.errors).sort()).toEqual(['replace', 'revision'])
    })
})
