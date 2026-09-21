import type { TAppSettings } from '@/domain/models/settings/types/TAppSettings'

export class AppSettings {
    public static readonly DefaultNodeShellImage = 'docker.io/library/alpine:3.20'

    public static defaults(): TAppSettings {
        return {
            kubectlPath: '',
            helmPath: '',
            nodeShellImage: '',
            closeToTray: false,
        }
    }

    public static parse(raw: unknown): TAppSettings {
        const source = AppSettings.asRecord(raw)

        return {
            kubectlPath: AppSettings.text(source.kubectlPath),
            helmPath: AppSettings.text(source.helmPath),
            nodeShellImage: AppSettings.text(source.nodeShellImage),
            closeToTray: source.closeToTray === true,
        }
    }

    public static serialize(settings: TAppSettings): Record<string, unknown> {
        return { ...AppSettings.parse(settings) }
    }

    public static version(raw: unknown): number {
        const value = AppSettings.asRecord(raw).version

        return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
    }

    public static nodeShellImageOf(settings: TAppSettings): string {
        return settings.nodeShellImage || AppSettings.DefaultNodeShellImage
    }

    private static asRecord(raw: unknown): Record<string, unknown> {
        return !!raw && typeof raw === 'object' && !Array.isArray(raw)
            ? raw as Record<string, unknown>
            : {}
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value.trim() : ''
    }
}
