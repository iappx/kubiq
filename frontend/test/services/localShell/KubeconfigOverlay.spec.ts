import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { KubeconfigOverlay } from '@/application/services/localShell/models/KubeconfigOverlay'
import { LocalShellCommand } from '@/application/services/localShell/models/LocalShellCommand'

const document = (overlay: Parameters<typeof KubeconfigOverlay.document>[0]): Record<string, any> =>
    parse(KubeconfigOverlay.document(overlay))

describe('KubeconfigOverlay', () => {
    it('writes into the user data folder, keyed by the context', () => {
        expect(KubeconfigOverlay.pathFor('prod-eu')).toBe('userdata:shell/prod-eu.kubeconfig')
    })

    it('turns a context name that is not a file name into one', () => {
        expect(KubeconfigOverlay.pathFor('arn:aws:eks:eu-west-1:1/cluster')).toBe('userdata:shell/arn-aws-eks-eu-west-1-1-cluster.kubeconfig')
        expect(KubeconfigOverlay.pathFor('')).toBe('userdata:shell/context.kubeconfig')
    })

    it('selects the context without redeclaring it when there is no namespace to force', () => {
        const overlay = document({ contextName: 'prod', clusterName: 'prod-cluster', userName: 'alex', namespace: '' })

        expect(overlay['current-context']).toBe('prod')
        expect(overlay.contexts).toBeUndefined()
    })

    it('declares a context of its own to carry the namespace', () => {
        const overlay = document({
            contextName: 'prod',
            clusterName: 'prod-cluster',
            userName: 'alex',
            namespace: 'payments',
        })

        expect(overlay['current-context']).toBe('kubiq-prod')
        expect(overlay.contexts).toEqual([{
            name: 'kubiq-prod',
            context: { cluster: 'prod-cluster', user: 'alex', namespace: 'payments' },
        }])
    })

    // The overlay is merged with the real kubeconfig, so it must carry names only.
    it('never carries credentials', () => {
        const text = KubeconfigOverlay.document({
            contextName: 'prod',
            clusterName: 'prod-cluster',
            userName: 'alex',
            namespace: 'payments',
        })

        expect(text).not.toContain('client-certificate')
        expect(text).not.toContain('token')
        expect(text).not.toContain('password')
        expect(text).not.toContain('server')
    })

    it('falls back to selecting the context when the cluster or user is unknown', () => {
        const overlay = document({ contextName: 'prod', clusterName: '', userName: '', namespace: 'payments' })

        expect(overlay['current-context']).toBe('prod')
        expect(overlay.contexts).toBeUndefined()
    })

    it('is a kubeconfig document', () => {
        const overlay = document({ contextName: 'prod', clusterName: '', userName: '', namespace: '' })

        expect(overlay.apiVersion).toBe('v1')
        expect(overlay.kind).toBe('Config')
    })
})

describe('LocalShellCommand', () => {
    it('opens PowerShell on Windows whatever SHELL says, preferring detected pwsh', () => {
        expect(LocalShellCommand.commandFor(true, '/bin/zsh')).toBe('powershell.exe')
        expect(LocalShellCommand.commandFor(true, '/bin/zsh', '', 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'))
            .toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe')
    })

    it('honours SHELL elsewhere and falls back to bash', () => {
        expect(LocalShellCommand.commandFor(false, '/bin/zsh')).toBe('/bin/zsh')
        expect(LocalShellCommand.commandFor(false, '  ')).toBe('/bin/bash')
    })

    it('lets an explicit setting override platform detection', () => {
        expect(LocalShellCommand.commandFor(true, '', '  C:\\Program Files\\Git\\bin\\bash.exe  ', 'pwsh.exe'))
            .toBe('C:\\Program Files\\Git\\bin\\bash.exe')
        expect(LocalShellCommand.commandFor(false, '/bin/zsh', ' /opt/homebrew/bin/fish '))
            .toBe('/opt/homebrew/bin/fish')
    })

    it('infers interactive arguments from the shell executable name', () => {
        expect(LocalShellCommand.argsFor('powershell.exe')).toEqual(['-NoLogo'])
        expect(LocalShellCommand.argsFor('C:\\Program Files\\PowerShell\\7\\pwsh.EXE')).toEqual(['-NoLogo'])
        expect(LocalShellCommand.argsFor('pwsh')).toEqual(['-NoLogo'])
        expect(LocalShellCommand.argsFor('/bin/zsh')).toEqual(['-l'])
        expect(LocalShellCommand.argsFor('/bin/bash')).toEqual(['-l'])
        expect(LocalShellCommand.argsFor('/opt/homebrew/bin/fish')).toEqual(['-l'])
        expect(LocalShellCommand.argsFor('C:\\Program Files\\Git\\bin\\bash.exe')).toEqual(['-l'])
        expect(LocalShellCommand.argsFor('/bin/sh')).toEqual(['-l'])
        expect(LocalShellCommand.argsFor('cmd.exe')).toEqual([])
        expect(LocalShellCommand.argsFor('/usr/local/bin/nu')).toEqual([])
        expect(LocalShellCommand.argsFor('  ')).toEqual([])
    })
})
