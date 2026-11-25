import type { TTerminalMode } from '@/domain/models/settings/types/TTerminalMode'

export type TAppSettings = {
    kubectlPath: string
    helmPath: string
    nodeShellImage: string
    terminalMode: TTerminalMode
    externalTerminalCommand: string
    terminalShell: string
    terminalFontFamily: string
    checkForUpdates: boolean
    skippedVersion: string
}
