import { describe, expect, it } from 'vitest'
import { AppSettings } from '@/domain/models/settings'

describe('AppSettings', () => {
    it('answers empty tool paths and an enabled update check by default', () => {
        expect(AppSettings.defaults()).toEqual({
            kubectlPath: '',
            helmPath: '',
            nodeShellImage: '',
            terminalMode: 'in-app',
            externalTerminalCommand: '',
            terminalShell: '',
            terminalFontFamily: '',
            checkForUpdates: true,
            skippedVersion: '',
        })
    })

    it('reads a stored document back', () => {
        const parsed = AppSettings.parse({
            kubectlPath: 'C:/tools/kubectl.exe',
            helmPath: 'C:/tools/helm.exe',
            nodeShellImage: 'registry.internal/shell:1',
            terminalMode: 'custom',
            externalTerminalCommand: 'Ghostty',
            terminalShell: '/bin/zsh',
            terminalFontFamily: 'JetBrainsMono Nerd Font',
            checkForUpdates: false,
            skippedVersion: '0.3.0',
        })

        expect(parsed).toEqual({
            kubectlPath: 'C:/tools/kubectl.exe',
            helmPath: 'C:/tools/helm.exe',
            nodeShellImage: 'registry.internal/shell:1',
            terminalMode: 'custom',
            externalTerminalCommand: 'Ghostty',
            terminalShell: '/bin/zsh',
            terminalFontFamily: 'JetBrainsMono Nerd Font',
            checkForUpdates: false,
            skippedVersion: '0.3.0',
        })
    })

    it('keeps checking for updates when the stored flag is not a boolean', () => {
        expect(AppSettings.parse({ checkForUpdates: 'no' }).checkForUpdates).toBe(true)
        expect(AppSettings.parse({}).checkForUpdates).toBe(true)
    })

    it('trims the paths it was handed', () => {
        const parsed = AppSettings.parse({
            kubectlPath: '  C:/tools/kubectl.exe  ',
            externalTerminalCommand: '  iTerm  ',
            terminalShell: '  pwsh.exe  ',
            terminalFontFamily: '  JetBrainsMono Nerd Font  ',
        })

        expect(parsed.kubectlPath).toBe('C:/tools/kubectl.exe')
        expect(parsed.externalTerminalCommand).toBe('iTerm')
        expect(parsed.terminalShell).toBe('pwsh.exe')
        expect(parsed.terminalFontFamily).toBe('JetBrainsMono Nerd Font')
    })

    it.each([
        ['null', null],
        ['a list', []],
        ['a string', 'kubectlPath=C:/tools'],
        ['a number', 7],
    ])('falls back to the defaults when the document is %s', (_name, raw) => {
        expect(AppSettings.parse(raw)).toEqual(AppSettings.defaults())
    })

    it('drops a field whose type is wrong instead of failing', () => {
        const parsed = AppSettings.parse({
            kubectlPath: 42,
            nodeShellImage: true,
            helmPath: null,
            terminalMode: 'bogus',
            externalTerminalCommand: 99,
            terminalShell: 7,
            terminalFontFamily: [],
        })

        expect(parsed.kubectlPath).toBe('')
        expect(parsed.helmPath).toBe('')
        expect(parsed.nodeShellImage).toBe('')
        expect(parsed.terminalMode).toBe('in-app')
        expect(parsed.externalTerminalCommand).toBe('')
        expect(parsed.terminalShell).toBe('')
        expect(parsed.terminalFontFamily).toBe('')
    })

    it('keeps nothing but the known keys when serialising', () => {
        const document = AppSettings.serialize({
            ...AppSettings.defaults(),
            kubectlPath: 'kubectl',
        })

        expect(Object.keys(document).sort()).toEqual([
            'checkForUpdates',
            'externalTerminalCommand',
            'helmPath',
            'kubectlPath',
            'nodeShellImage',
            'skippedVersion',
            'terminalFontFamily',
            'terminalMode',
            'terminalShell',
        ])
    })

    it('leaves a setting it no longer knows behind when it reads and writes a document', () => {
        const document = AppSettings.serialize(AppSettings.parse({ kubectlPath: 'kubectl', closeToTray: true }))

        expect(document).not.toHaveProperty('closeToTray')
    })

    it('reads a version stamp, and treats anything unusable as version zero', () => {
        expect(AppSettings.version({ version: 3 })).toBe(3)
        expect(AppSettings.version({ version: '3' })).toBe(0)
        expect(AppSettings.version({ version: -1 })).toBe(0)
        expect(AppSettings.version({ version: 1.5 })).toBe(0)
        expect(AppSettings.version(null)).toBe(0)
    })

    it('answers the built-in node shell image when none was chosen', () => {
        expect(AppSettings.nodeShellImageOf(AppSettings.defaults())).toBe(AppSettings.DefaultNodeShellImage)
        expect(AppSettings.nodeShellImageOf({ ...AppSettings.defaults(), nodeShellImage: 'own:1' })).toBe('own:1')
    })
})
