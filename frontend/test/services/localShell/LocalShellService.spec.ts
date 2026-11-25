import { beforeEach, describe, expect, it } from 'vitest'
import type { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import type { ExecutableService } from '@/application/services/executable/ExecutableService'
import type { TExecutableLocation } from '@/application/services/executable/types/TExecutableLocation'
import type { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { LocalShellService } from '@/application/services/localShell/LocalShellService'
import type { SettingsService } from '@/application/services/settings/SettingsService'
import { AppSettings } from '@/domain/models/settings'
import type { TAppSettings } from '@/domain/models/settings'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

let settings: TAppSettings
let isWindows: boolean
let envValues: Record<string, string>
let located: Record<string, TExecutableLocation>
let files: MemoryFileTransport

const createService = (): LocalShellService => {
    const settingsService = {
        read: async () => settings,
    } as unknown as SettingsService

    const executableService = {
        isWindows: async () => isWindows,
        locate: async (name: string) => located[name] ?? { name, path: '', source: 'none' },
    } as unknown as ExecutableService

    const kubeconfigService = {
        locate: async () => ['/home/user/.kube/config'],
        getContexts: async () => [{ name: 'prod', clusterName: 'prod-cluster', userName: 'alex' }],
    } as unknown as KubeconfigService

    const catalogService = {
        getSourcePaths: async () => [],
    } as unknown as ClusterCatalogService

    const environment = {
        get: async (name: string) => envValues[name] ?? '',
        pathListSeparator: async () => (isWindows ? ';' : ':'),
        expand: async (value: string) => value.replace(/^~/, '/home/user'),
    } as unknown as EnvironmentAdapter

    const host = {
        absolutePath: async (path: string) => `/abs/${path}`,
    } as unknown as HostShellAdapter

    return new LocalShellService(
        settingsService,
        executableService,
        kubeconfigService,
        catalogService,
        environment,
        host,
        files as unknown as FileSystemTransport,
    )
}

describe('LocalShellService', () => {
    beforeEach(() => {
        settings = AppSettings.defaults()
        isWindows = false
        envValues = { SHELL: '/bin/zsh', PATH: '/usr/bin' }
        located = {
            kubectl: { name: 'kubectl', path: '/usr/bin/kubectl', source: 'path' },
        }
        files = new MemoryFileTransport()
    })

    it('always sets TERM and COLORTERM alongside KUBECONFIG', async () => {
        const plan = await createService().prepare('prod', 'payments')

        expect(plan.env.TERM).toBe('xterm-256color')
        expect(plan.env.COLORTERM).toBe('truecolor')
        expect(plan.env.KUBECONFIG).toContain('/abs/userdata:shell/prod.kubeconfig')
    })

    it('prepends the configured kubectl folder to PATH without dropping TERM', async () => {
        settings = { ...AppSettings.defaults(), kubectlPath: '/opt/k8s/kubectl' }
        located.kubectl = { name: 'kubectl', path: '/opt/k8s/kubectl', source: 'settings' }

        const plan = await createService().prepare('prod', '')

        expect(plan.env.PATH).toBe('/opt/k8s:/usr/bin')
        expect(plan.env.TERM).toBe('xterm-256color')
        expect(plan.env.COLORTERM).toBe('truecolor')
    })

    it('prefers pwsh on Windows when installed on PATH', async () => {
        isWindows = true
        located.pwsh = { name: 'pwsh', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.EXE', source: 'path' }

        const plan = await createService().prepare('prod', '')

        expect(plan.command).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.EXE')
        expect(plan.args).toEqual(['-NoLogo'])
    })

    it('falls back to powershell.exe on Windows when pwsh is not installed', async () => {
        isWindows = true

        const plan = await createService().prepare('prod', '')

        expect(plan.command).toBe('powershell.exe')
        expect(plan.args).toEqual(['-NoLogo'])
    })

    it('uses SHELL on Unix and falls back to /bin/bash when unset', async () => {
        const zshPlan = await createService().prepare('prod', '')
        expect(zshPlan.command).toBe('/bin/zsh')
        expect(zshPlan.args).toEqual(['-l'])

        envValues.SHELL = ''
        const bashPlan = await createService().prepare('prod', '')
        expect(bashPlan.command).toBe('/bin/bash')
        expect(bashPlan.args).toEqual(['-l'])
    })

    it('uses the configured shell from settings, expands it, and infers arguments', async () => {
        settings = { ...AppSettings.defaults(), terminalShell: '~/bin/fish' }

        const plan = await createService().prepare('prod', '')

        expect(plan.command).toBe('/home/user/bin/fish')
        expect(plan.args).toEqual(['-l'])
    })

    it('passes no extra flags for an unknown configured shell', async () => {
        isWindows = true
        settings = { ...AppSettings.defaults(), terminalShell: 'cmd.exe' }

        const plan = await createService().prepare('prod', '')

        expect(plan.command).toBe('cmd.exe')
        expect(plan.args).toEqual([])
    })
})
