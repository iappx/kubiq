import { inject, singleton } from 'tsyringe'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmTimeouts } from '@/domain/models/helm/HelmTimeouts'
import { HelmVersionInfo } from '@/domain/models/helm/HelmVersionInfo'
import type { THelmAvailability } from '@/domain/models/helm/types/THelmAvailability'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { ProcessCollector } from '@/infrastructure/process/ProcessCollector'

@singleton()
export class HelmVersionAdapter {
    public static readonly missing: string = 'Helm was not found on this machine'

    public static readonly hostless: string = 'Helm can only be run from the desktop application'

    public static readonly unresponsive: string =
        `Helm did not answer within ${HelmTimeouts.seconds(HelmTimeouts.probeMs)} seconds`

    constructor(
        @inject(ProcessAdapter) private readonly processes: ProcessAdapter,
    ) {}

    public async read(executable: string): Promise<THelmAvailability> {
        if (!this.processes.isAvailable()) {
            return HelmVersionAdapter.absent(executable, HelmVersionAdapter.hostless, '')
        }

        const outcome = await this.processes.collect({
            command: executable,
            args: HelmCommand.version(),
            timeoutMs: HelmTimeouts.probeMs,
        })

        if (outcome.code === ProcessCollector.expiredCode) {
            return HelmVersionAdapter.absent(
                executable,
                HelmVersionAdapter.unresponsive,
                `"${executable} ${HelmCommand.version().join(' ')}" was still running and has been stopped`,
            )
        }

        if (outcome.code !== 0) {
            return HelmVersionAdapter.absent(
                executable,
                HelmVersionAdapter.missing,
                [outcome.stderr, outcome.stdout].filter(part => part.trim() !== '').join('\n').trim(),
            )
        }

        const version = HelmVersionInfo.parse(outcome.stdout)
        if (!HelmVersionInfo.isSupported(version)) {
            return {
                available: false,
                executable,
                version,
                reason: HelmVersionInfo.unsupportedReason(version),
                detail: outcome.stdout.trim(),
            }
        }

        return { available: true, executable, version, reason: '', detail: '' }
    }

    private static absent(executable: string, reason: string, detail: string): THelmAvailability {
        return { available: false, executable, version: '', reason, detail }
    }
}
