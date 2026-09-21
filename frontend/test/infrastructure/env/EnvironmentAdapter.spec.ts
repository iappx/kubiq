import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const homeDir = vi.fn()
const separator = vi.fn()
const expand = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/env', () => ({
    EnvService: {
        Get: (...args: unknown[]) => get(...args),
        UserHomeDir: () => homeDir(),
        PathSeparator: () => separator(),
        Expand: (...args: unknown[]) => expand(...args),
    },
}))

import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const available = new EnvironmentAdapter({ isAvailable: () => true } as WailsRuntimeService)
const absent = new EnvironmentAdapter({ isAvailable: () => false } as WailsRuntimeService)

describe('EnvironmentAdapter', () => {
    beforeEach(() => {
        get.mockReset()
        homeDir.mockReset()
        separator.mockReset()
        expand.mockReset()
    })

    it('passes the value of a variable through', async () => {
        get.mockResolvedValue({ success: true, value: 'C:/a/config;C:/b/config' })

        await expect(available.get('KUBECONFIG')).resolves.toBe('C:/a/config;C:/b/config')
        expect(get).toHaveBeenCalledWith('KUBECONFIG')
    })

    it('answers with nothing for a variable that is not set', async () => {
        get.mockResolvedValue({ success: false, value: '', error: 'environment variable is not set' })

        await expect(available.get('KUBECONFIG')).resolves.toBe('')
    })

    it('reports the home directory and the path list separator', async () => {
        homeDir.mockResolvedValue({ success: true, value: 'C:/Users/tester' })
        separator.mockResolvedValue({ success: true, value: ';' })

        await expect(available.homeDir()).resolves.toBe('C:/Users/tester')
        await expect(available.pathListSeparator()).resolves.toBe(';')
    })

    it('expands a path through the Go side', async () => {
        expand.mockResolvedValue({ success: true, value: 'C:/Users/tester/.kube/config' })

        await expect(available.expand('~/.kube/config')).resolves.toBe('C:/Users/tester/.kube/config')
        expect(expand).toHaveBeenCalledWith('~/.kube/config')
    })

    it('answers with nothing when the binding call rejects', async () => {
        homeDir.mockRejectedValue(new Error('binding is gone'))

        await expect(available.homeDir()).resolves.toBe('')
    })

    it('knows nothing at all without the Wails runtime', async () => {
        await expect(absent.get('KUBECONFIG')).resolves.toBe('')
        await expect(absent.homeDir()).resolves.toBe('')
        await expect(absent.pathListSeparator()).resolves.toBe('')
        await expect(absent.expand('~/.kube/config')).resolves.toBe('')
        expect(get).not.toHaveBeenCalled()
        expect(homeDir).not.toHaveBeenCalled()
    })
})
