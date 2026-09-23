import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/domain/errors/ApiError'
import { ReleaseContextProvider } from '@/infrastructure/entityRepo/release/ReleaseContextProvider'
import { ReleaseEntitySetOptions } from '@/infrastructure/entityRepo/release/ReleaseEntitySetOptions'
import { ReleaseTransport } from '@/infrastructure/entityRepo/release/transport/ReleaseTransport'

const fetchMock = vi.fn()

const answer = (status: number, body: unknown): Response => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
})

const latest = {
    id: 7,
    tag_name: 'v0.2.0',
    name: 'kubiq 0.2.0',
    draft: false,
    prerelease: false,
    html_url: 'https://github.com/iappx/kubiq/releases/tag/v0.2.0',
    published_at: '2026-09-30T10:00:00Z',
    body: 'Notes',
    assets: [{
        id: 70,
        name: 'kubiq-0.2.0-windows-amd64-installer.exe',
        size: 8123717,
        content_type: 'application/x-msdownload',
        browser_download_url: 'https://github.com/iappx/kubiq/releases/download/v0.2.0/kubiq-0.2.0-windows-amd64-installer.exe',
        digest: `sha256:${'0'.repeat(64)}`,
    }],
}

const context = () => new ReleaseContextProvider(new ReleaseTransport()).context

describe('ReleaseEntityContext', () => {
    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('asks GitHub for the latest release of the configured repository', async () => {
        fetchMock.mockResolvedValue(answer(200, latest))

        await context().releases.getOne(ReleaseEntitySetOptions.latestKey)

        const [url, request] = fetchMock.mock.calls[0]
        expect(url).toBe('https://api.github.com/repos/iappx/kubiq/releases/latest')
        expect(request.method).toBe('GET')
        expect(request.headers.accept).toBe('application/vnd.github+json')
    })

    it('maps the snake_case answer onto the release and its assets', async () => {
        fetchMock.mockResolvedValue(answer(200, latest))

        const release = await context().releases.getOne(ReleaseEntitySetOptions.latestKey)

        expect(release?.tagName).toBe('v0.2.0')
        expect(release?.htmlUrl).toBe(latest.html_url)
        expect(release?.publishedAt).toBe(latest.published_at)
        expect(release?.assets).toHaveLength(1)
        expect(release?.assets[0].browserDownloadUrl).toBe(latest.assets[0].browser_download_url)
        expect(release?.assets[0].digest).toBe(latest.assets[0].digest)
    })

    it('reports a repository without releases in words the user can read', async () => {
        fetchMock.mockResolvedValue(answer(404, { message: 'Not Found' }))

        const failure = await context().releases.getOne(ReleaseEntitySetOptions.latestKey).catch(err => err)

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.message).toBe('No kubiq release is published on GitHub yet')
        expect(failure.details).toBe('Not Found')
        expect(failure.status).toBe(404)
    })

    it('reports an exhausted anonymous quota as a reason to wait', async () => {
        fetchMock.mockResolvedValue(answer(403, { message: 'API rate limit exceeded' }))

        const failure = await context().releases.getOne(ReleaseEntitySetOptions.latestKey).catch(err => err)

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.message).toContain('Try again in an hour')
        expect(failure.details).toBe('API rate limit exceeded')
    })

    it('reports an unreachable GitHub as an ApiError instead of a raw network failure', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

        const failure = await context().releases.getOne(ReleaseEntitySetOptions.latestKey).catch(err => err)

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.message).toBe('Could not reach GitHub to check for updates')
        expect(failure.details).toBe('Failed to fetch')
    })
})
