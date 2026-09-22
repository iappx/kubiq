import type { TPodEnvironmentEntry } from '@/application/services/podEnvironment/types/TPodEnvironmentEntry'
import type { TPodEnvironmentGroup } from '@/application/services/podEnvironment/types/TPodEnvironmentGroup'

export class PodEnvironmentText {
    public static copyable(group: TPodEnvironmentGroup): TPodEnvironmentEntry[] {
        return group.entries.filter(entry => PodEnvironmentText.hasValue(entry))
    }

    public static of(entries: readonly TPodEnvironmentEntry[]): string {
        return entries.map(entry => PodEnvironmentText.lineOf(entry)).join('\n')
    }

    public static lineOf(entry: TPodEnvironmentEntry): string {
        return `${entry.variable}=${entry.value}`
    }

    // A downward-API path is what the kubelet substitutes, not a value to paste anywhere.
    public static hasValue(entry: TPodEnvironmentEntry): boolean {
        return entry.variable !== '' && (entry.state === 'literal' || entry.state === 'resolved')
    }

    public static hidesSecret(group: TPodEnvironmentGroup): boolean {
        return group.entries.some(entry => entry.masked)
    }
}
