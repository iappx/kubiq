import { describe, expect, it } from 'vitest'
import { ExternalTerminalCommand } from '@/application/services/localShell/models/ExternalTerminalCommand'
import { ApiError } from '@/domain/errors/ApiError'

const baseEnv = { KUBECONFIG: '/tmp/prod.kubeconfig:/home/user/.kube/config' }

describe('ExternalTerminalCommand', () => {
    describe('Windows', () => {
        it('opens a new tab in Windows Terminal when wt is detected', () => {
            const spec = ExternalTerminalCommand.build({
                platform: 'windows',
                mode: 'system',
                customCommand: '',
                detectedTerminal: 'C:\\Users\\alex\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
                shellCommand: 'pwsh.exe',
                shellArgs: ['-NoLogo'],
                env: baseEnv,
            })

            expect(spec).toEqual({
                path: 'C:\\Users\\alex\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
                args: ['new-tab', 'pwsh.exe', '-NoLogo'],
                env: baseEnv,
            })
        })

        it('falls back to launching the shell directly when Windows Terminal is absent', () => {
            const spec = ExternalTerminalCommand.build({
                platform: 'windows',
                mode: 'system',
                customCommand: '',
                detectedTerminal: '',
                shellCommand: 'powershell.exe',
                shellArgs: ['-NoLogo'],
                env: baseEnv,
            })

            expect(spec).toEqual({
                path: 'powershell.exe',
                args: ['-NoLogo'],
                env: baseEnv,
            })
        })

        it('launches a custom terminal with env on Windows', () => {
            const spec = ExternalTerminalCommand.build({
                platform: 'windows',
                mode: 'custom',
                customCommand: 'C:\\Tools\\alacritty.exe',
                detectedTerminal: 'wt.exe',
                shellCommand: 'pwsh.exe',
                shellArgs: ['-NoLogo'],
                env: baseEnv,
            })

            expect(spec).toEqual({
                path: 'C:\\Tools\\alacritty.exe',
                args: [],
                env: baseEnv,
            })
        })

        it('uses new-tab arguments when the custom Windows terminal is wt.exe', () => {
            const spec = ExternalTerminalCommand.build({
                platform: 'windows',
                mode: 'custom',
                customCommand: 'wt.exe',
                detectedTerminal: '',
                shellCommand: 'pwsh.exe',
                shellArgs: ['-NoLogo'],
                env: baseEnv,
            })

            expect(spec).toEqual({
                path: 'wt.exe',
                args: ['new-tab', 'pwsh.exe', '-NoLogo'],
                env: baseEnv,
            })
        })

        it('raises an ApiError when custom mode has no configured command', () => {
            expect(() => ExternalTerminalCommand.build({
                platform: 'windows',
                mode: 'custom',
                customCommand: '   ',
                detectedTerminal: '',
                shellCommand: 'pwsh.exe',
                shellArgs: ['-NoLogo'],
                env: baseEnv,
            })).toThrow(ApiError)
        })
    })

    describe('macOS', () => {
        it('uses osascript targeting Terminal.app in system mode with escaped KUBECONFIG', () => {
            const env = { KUBECONFIG: "/Users/o'connor/prod.kubeconfig" }
            const spec = ExternalTerminalCommand.build({
                platform: 'darwin',
                mode: 'system',
                customCommand: '',
                detectedTerminal: '',
                shellCommand: '/bin/zsh',
                shellArgs: ['-l'],
                env,
            })

            expect(spec.path).toBe('osascript')
            expect(spec.args).toEqual([
                '-e',
                'tell application "Terminal" to activate',
                '-e',
                `tell application "Terminal" to do script "export KUBECONFIG='/Users/o'\\\\''connor/prod.kubeconfig'; exec '/bin/zsh' '-l'"`,
            ])
            expect(spec.env).toEqual(env)
        })

        it('uses osascript targeting iTerm when custom terminal is iTerm or iTerm2', () => {
            for (const name of ['iTerm', 'iTerm2', 'iTerm.app']) {
                const spec = ExternalTerminalCommand.build({
                    platform: 'darwin',
                    mode: 'custom',
                    customCommand: name,
                    detectedTerminal: '',
                    shellCommand: '/bin/zsh',
                    shellArgs: ['-l'],
                    env: baseEnv,
                })

                expect(spec.path).toBe('osascript')
                expect(spec.args[1]).toBe('tell application "iTerm" to activate')
                expect(spec.args[3]).toContain('tell application "iTerm" to create window with default profile command')
                expect(spec.args[3]).toContain("export KUBECONFIG='/tmp/prod.kubeconfig:/home/user/.kube/config'")
            }
        })

        it('launches known CLI terminals and binary paths directly with env on macOS', () => {
            const kitty = ExternalTerminalCommand.build({
                platform: 'darwin',
                mode: 'custom',
                customCommand: 'kitty',
                detectedTerminal: '',
                shellCommand: '/bin/zsh',
                shellArgs: ['-l'],
                env: baseEnv,
            })
            expect(kitty).toEqual({
                path: 'kitty',
                args: ['/bin/zsh', '-l'],
                env: baseEnv,
            })

            const alacritty = ExternalTerminalCommand.build({
                platform: 'darwin',
                mode: 'custom',
                customCommand: '/opt/homebrew/bin/alacritty',
                detectedTerminal: '',
                shellCommand: '/bin/zsh',
                shellArgs: ['-l'],
                env: baseEnv,
            })
            expect(alacritty).toEqual({
                path: '/opt/homebrew/bin/alacritty',
                args: ['-e', '/bin/zsh', '-l'],
                env: baseEnv,
            })
        })

        it('uses open -a for other macOS application names', () => {
            const spec = ExternalTerminalCommand.build({
                platform: 'darwin',
                mode: 'custom',
                customCommand: 'Warp',
                detectedTerminal: '',
                shellCommand: '/bin/zsh',
                shellArgs: ['-l'],
                env: baseEnv,
            })

            expect(spec).toEqual({
                path: 'open',
                args: ['-a', 'Warp'],
                env: baseEnv,
            })
        })
    })

    describe('Linux', () => {
        it.each([
            ['/usr/bin/gnome-terminal', ['--', '/bin/bash', '-l']],
            ['/usr/bin/konsole', ['-e', '/bin/bash', '-l']],
            ['/usr/bin/kitty', ['/bin/bash', '-l']],
            ['/usr/bin/alacritty', ['-e', '/bin/bash', '-l']],
            ['/usr/bin/wezterm', ['start', '--', '/bin/bash', '-l']],
            ['/usr/bin/xfce4-terminal', ['-e', '/bin/bash', '-l']],
            ['/usr/bin/xterm', ['-e', '/bin/bash', '-l']],
            ['/usr/bin/x-terminal-emulator', ['-e', '/bin/bash', '-l']],
        ])('builds arguments for %s', (terminal, expectedArgs) => {
            const spec = ExternalTerminalCommand.build({
                platform: 'linux',
                mode: 'system',
                customCommand: '',
                detectedTerminal: terminal,
                shellCommand: '/bin/bash',
                shellArgs: ['-l'],
                env: baseEnv,
            })

            expect(spec).toEqual({
                path: terminal,
                args: expectedArgs,
                env: baseEnv,
            })
        })

        it('raises an ApiError when no system terminal is available on Linux', () => {
            expect(() => ExternalTerminalCommand.build({
                platform: 'linux',
                mode: 'system',
                customCommand: '',
                detectedTerminal: '',
                shellCommand: '/bin/bash',
                shellArgs: ['-l'],
                env: baseEnv,
            })).toThrow(ApiError)
        })

        it('launches a custom terminal on Linux with env', () => {
            const spec = ExternalTerminalCommand.build({
                platform: 'linux',
                mode: 'custom',
                customCommand: '/usr/bin/alacritty',
                detectedTerminal: '/usr/bin/xterm',
                shellCommand: '/bin/zsh',
                shellArgs: ['-l'],
                env: baseEnv,
            })

            expect(spec).toEqual({
                path: '/usr/bin/alacritty',
                args: ['-e', '/bin/zsh', '-l'],
                env: baseEnv,
            })
        })
    })
})
