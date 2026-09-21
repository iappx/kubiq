import type { ITransport } from '@iappx/entity-repo'
import { ApiError } from '@/domain/errors/ApiError'
import { HelmInvocationBase } from '@/infrastructure/entityRepo/helm/transport/base/HelmInvocationBase'
import type { THelmRequest } from '@/infrastructure/entityRepo/helm/transport/types/THelmRequest'
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
        })

        if (outcome.code !== 0) {
            throw HelmTransport.failure(outcome)
        }

        return (request.json === true ? HelmTransport.parse(outcome.stdout) : outcome.stdout) as TRes
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
