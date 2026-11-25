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
import type { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import type { TLaunchSpec } from '@/infrastructure/process/types/TLaunchSpec'
import type { AppHostAdapter } from '@/infrastructure/wails/AppHostAdapter'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

let settings: TAppSettings
let isWindows: boolean
let hostOs: string
let envValues: Record<string, string>
let located: Record<string, TExecutableLocation>
let files: MemoryFileTransport
let launched: TLaunchSpec[]

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

    const processes = {
        launch: async (spec: TLaunchSpec) => {
            launched.push(spec)
        },
    } as unknown as ProcessAdapter

    const appHost = {
        platform: async () => ({ os: hostOs, arch: 'amd64' }),
    } as unknown as AppHostAdapter

    return new LocalShellService(
        settingsService,
        executableService,
        kubeconfigService,
        catalogService,
        environment,
        host,
        files as unknown as FileSystemTransport,
        processes,
        appHost,
    )
}

describe('LocalShellService', () => {
    beforeEach(() => {
        settings = AppSettings.defaults()
        isWindows = false
        hostOs = 'linux'
        envValues = { SHELL: '/bin/zsh', PATH: '/usr/bin' }
        located = {
            kubectl: { name: 'kubectl', path: '/usr/bin/kubectl', source: 'path' },
        }
        files = new MemoryFileTransport()
        launched = []
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

    describe('launchExternal', () => {
        it('launches Windows Terminal with KUBECONFIG when detected in system mode', async () => {
            hostOs = 'windows'
            isWindows = true
            settings = { ...AppSettings.defaults(), terminalMode: 'system' }
            located.wt = { name: 'wt', path: 'C:\\WindowsApps\\wt.exe', source: 'path' }
            located.pwsh = { name: 'pwsh', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', source: 'path' }

            await createService().launchExternal('prod', 'payments')

            expect(launched).toHaveLength(1)
            expect(launched[0].path).toBe('C:\\WindowsApps\\wt.exe')
            expect(launched[0].args).toEqual(['new-tab', 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', '-NoLogo'])
            expect(launched[0].env?.KUBECONFIG).toContain('/abs/userdata:shell/prod.kubeconfig')
        })

        it('launches macOS Terminal via osascript in system mode', async () => {
            hostOs = 'darwin'
            settings = { ...AppSettings.defaults(), terminalMode: 'system' }

            await createService().launchExternal('prod', 'payments')

            expect(launched).toHaveLength(1)
            expect(launched[0].path).toBe('osascript')
            expect(launched[0].args[3]).toContain('tell application "Terminal" to do script')
            expect(launched[0].args[3]).toContain('KUBECONFIG=')
        })

        it('probes common Linux terminals in order and launches the first installed one', async () => {
            hostOs = 'linux'
            settings = { ...AppSettings.defaults(), terminalMode: 'system' }
            located.alacritty = { name: 'alacritty', path: '/usr/bin/alacritty', source: 'path' }

            await createService().launchExternal('prod', 'payments')

            expect(launched).toHaveLength(1)
            expect(launched[0]).toEqual({
                path: '/usr/bin/alacritty',
                args: ['-e', '/bin/zsh', '-l'],
                env: {
                    KUBECONFIG: '/abs/userdata:shell/prod.kubeconfig:/home/user/.kube/config',
                },
            })
        })

        it('preserves a bare custom app name on macOS without path expansion', async () => {
            hostOs = 'darwin'
            settings = { ...AppSettings.defaults(), terminalMode: 'custom', externalTerminalCommand: 'Warp' }

            await createService().launchExternal('prod', '')

            expect(launched).toHaveLength(1)
            expect(launched[0].path).toBe('open')
            expect(launched[0].args).toEqual(['-a', 'Warp'])
        })

        it('expands a tilde-prefixed custom terminal path', async () => {
            hostOs = 'linux'
            settings = { ...AppSettings.defaults(), terminalMode: 'custom', externalTerminalCommand: '~/bin/alacritty' }

            await createService().launchExternal('prod', '')

            expect(launched).toHaveLength(1)
            expect(launched[0].path).toBe('/home/user/bin/alacritty')
            expect(launched[0].args).toEqual(['-e', '/bin/zsh', '-l'])
        })
    })
})
