import { singleton } from 'tsyringe'
import { FetchTransport, RestRequestError } from '@iappx/entity-repo-rest'
import type { TRestRequest } from '@iappx/entity-repo-rest'
import { ApiError } from '@/domain/errors/ApiError'

@singleton()
export class ReleaseTransport extends FetchTransport {
    public static readonly baseUrl: string = 'https://api.github.com'

    constructor() {
        super({
            baseUrl: ReleaseTransport.baseUrl,
            headers: {
                accept: 'application/vnd.github+json',
                'x-github-api-version': '2022-11-28',
            },
        })
    }

    public async send<TRes>(request: TRestRequest): Promise<TRes> {
        try {
            return await super.send<TRes>(request)
        } catch (err) {
            throw ReleaseTransport.apiError(err)
        }
    }

    protected static apiError(err: unknown): ApiError {
        if (!(err instanceof RestRequestError) || err.status === 0) {
            return new ApiError(
                'Could not reach GitHub to check for updates',
                err instanceof Error ? err.message : String(err),
            )
        }

        const details = ReleaseTransport.messageOf(err.body) || err.message

        if (err.status === 404) {
            return new ApiError('No kubiq release is published on GitHub yet', details, err.status)
        }
        // GitHub answers an exhausted anonymous quota (60 requests an hour) with 403 as well as 429.
        if (err.status === 403 || err.status === 429) {
            return new ApiError('GitHub refused the update check for now. Try again in an hour', details, err.status)
        }

        return new ApiError(`GitHub answered the update check with status ${err.status}`, details, err.status)
    }

    protected static messageOf(body: unknown): string {
        if (typeof body === 'string') {
            return body
        }
        if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).message === 'string') {
            return (body as Record<string, string>).message
        }

        return ''
    }
}
