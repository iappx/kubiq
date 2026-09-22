import type { ITransport } from '@iappx/entity-repo'
import { ApiError } from '@/domain/errors/ApiError'
import { HelmTimeouts } from '@/domain/models/helm/HelmTimeouts'
import { HelmInvocationBase } from '@/infrastructure/entityRepo/helm/transport/base/HelmInvocationBase'
import type { THelmRequest } from '@/infrastructure/entityRepo/helm/transport/types/THelmRequest'
import { ProcessCollector } from '@/infrastructure/process/ProcessCollector'
import type { TProcessOutcome } from '@/infrastructure/process/types/TProcessOutcome'

export class HelmTransport extends HelmInvocationBase implements ITransport<THelmRequest> {
    public static readonly unreadable: string = 'The helm command failed'

    public async send<TRes>(request: THelmRequest): Promise<TRes> {
        if (!this.processes.isAvailable()) {
            return null as TRes
        }

        const outcome = await this.processes.collect({
            command: this.environment.executable,
            args: this.argsOf(request.args),
            env: this.env(),
            timeoutMs: HelmTimeouts.readMs,
        })

        if (outcome.code === ProcessCollector.expiredCode) {
            throw HelmTransport.expired(request.args)
        }
        if (outcome.code !== 0) {
            throw HelmTransport.failure(outcome)
        }

        return (request.json === true ? HelmTransport.parse(outcome.stdout) : outcome.stdout) as TRes
    }

    public static expired(args: readonly string[]): ApiError {
        return new ApiError(
            `Helm did not answer within ${HelmTimeouts.seconds(HelmTimeouts.readMs)} seconds`,
            `"helm ${HelmTransport.subcommand(args)}" was still running and has been stopped. `
            + 'The cluster may be unreachable, or helm may be waiting for a credential helper on this machine.',
            ProcessCollector.expiredCode,
        )
    }

    // Only the leading words: anything past the first flag may be a value worth keeping out of a message.
    protected static subcommand(args: readonly string[]): string {
        const words: string[] = []
        for (const arg of args) {
            if (arg.startsWith('-')) {
                break
            }
            words.push(arg)
        }

        return words.join(' ')
    }

    // Passed through verbatim on purpose: rewording helm hides the chart, field or hook that failed.
    public static failure(outcome: TProcessOutcome): ApiError {
        const whole = [outcome.stderr, outcome.stdout].filter(part => part.trim() !== '').join('\n').trim()
        const headline = whole.split('\n').map(line => line.trim()).find(line => line !== '')

        return new ApiError(
            headline ?? `${HelmTransport.unreadable} with exit code ${outcome.code}`,
            whole === '' ? `Exit code ${outcome.code}` : whole,
            outcome.code,
        )
    }

    protected static parse(stdout: string): unknown {
        const text = stdout.trim()
        if (text === '') {
            return []
        }

        try {
            return JSON.parse(text)
        } catch (err) {
            throw new ApiError(
                'Helm answered with something that is not JSON',
                err instanceof Error ? err.message : String(err),
            )
        }
    }
}
