import { describe, expect, it } from 'vitest'
import { KubeconfigFileEntity } from '@/domain/entities/kubeconfig'

const file = (name: string, changes: Partial<Record<'isDirectory' | 'size' | 'modifiedAt', unknown>> = {}) =>
    KubeconfigFileEntity.build({
        path: `/home/tester/.kube/${name}`,
        name,
        isDirectory: false,
        size: 2048,
        modifiedAt: 1700000000000,
        ...changes,
    })

describe('KubeconfigFileEntity', () => {
    it('takes a plain file as a kubeconfig candidate', () => {
        expect(file('config').isCandidate).toBe(true)
        expect(file('staging.yaml').isCandidate).toBe(true)
    })

    it('passes over folders, dotfiles and anything too large to be a kubeconfig', () => {
        expect(file('cache', { isDirectory: true }).isCandidate).toBe(false)
        expect(file('.DS_Store').isCandidate).toBe(false)
        expect(file('backup.tar', { size: KubeconfigFileEntity.MaxSize + 1 }).isCandidate).toBe(false)
    })

    it('knows kubectl\'s own file by its name', () => {
        expect(file('config').isDefault).toBe(true)
        expect(file('config.yaml').isDefault).toBe(false)
    })

    it('stamps a file so that an edit or a resize shows', () => {
        const original = file('config').stamp

        expect(file('config', { modifiedAt: 1700000000001 }).stamp).not.toBe(original)
        expect(file('config', { size: 2049 }).stamp).not.toBe(original)
        expect(file('config').stamp).toBe(original)
    })
})
