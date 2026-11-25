import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KubeconfigExecService } from '@/application/services/kubeconfig/KubeconfigExecService'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import type { TKubeconfigExecConfig } from '@/domain/entities/kubeconfig/types/TKubeconfigExecConfig'
import { ApiError } from '@/domain/errors/ApiError'
import type { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { ProcessCollector } from '@/infrastructure/process/ProcessCollector'
import type { TProcessOutcome } from '@/infrastructure/process/types/TProcessOutcome'
import type { TProcessSpec } from '@/infrastructure/process/types/TProcessSpec'

const collect = vi.fn<(spec: TProcessSpec) => Promise<TProcessOutcome>>()
const expand = vi.fn<(path: string) => Promise<string>>()

const buildContext = (overrides: Partial<TKubeconfigExecConfig> = {}, filePath = 'C:/Users/tester/.kube/config'): KubeconfigContextEntity =>
    KubeconfigContextEntity.build({
        name: 'eks-prod',
        clusterName: 'eks-prod',
        userName: 'eks-user',
        filePath,
        cluster: {
            name: 'eks-prod',
            server: 'https://eks.example.internal:6443',
            certificateAuthorityData: 'ZmFrZS1jYQ==',
            filePath,
        },
        user: {
            name: 'eks-user',
            usesExec: true,
            filePath,
            execConfig: {
                apiVersion: 'client.authentication.k8s.io/v1beta1',
                command: 'aws',
                args: ['eks', 'get-token', '--cluster-name', 'prod'],
                env: [{ name: 'AWS_PROFILE', value: 'prod' }],
                installHint: '',
                interactiveMode: 'IfAvailable',
                provideClusterInfo: false,
                ...overrides,
            },
        },
    })

const execOutput = (token: string, expirationTimestamp?: string): string => JSON.stringify({
    apiVersion: 'client.authentication.k8s.io/v1beta1',
    kind: 'ExecCredential',
    status: {
        token,
        ...(expirationTimestamp ? { expirationTimestamp } : {}),
    },
})

let service: KubeconfigExecService

describe('KubeconfigExecService', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
        collect.mockReset()
        expand.mockReset()
        expand.mockImplementation(async (path: string) => path.replace('~', 'C:/Users/tester'))

        service = new KubeconfigExecService(
            { collect } as unknown as ProcessAdapter,
            { expand } as unknown as EnvironmentAdapter,
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('runs the exec command with merged env and KUBERNETES_EXEC_INFO and returns the token', async () => {
        collect.mockResolvedValue({
            code: 0,
            stdout: execOutput('fake-eks-token', '2026-06-01T12:15:00Z'),
            stderr: '',
        })

        const credential = await service.resolve(buildContext({ provideClusterInfo: true }))

        expect(credential.token).toBe('fake-eks-token')
        expect(credential.expiresAt).toBe(Date.parse('2026-06-01T12:15:00Z'))
        expect(collect).toHaveBeenCalledTimes(1)

        const spec = collect.mock.calls[0][0]
        expect(spec.command).toBe('aws')
        expect(spec.args).toEqual(['eks', 'get-token', '--cluster-name', 'prod'])
        expect(spec.env?.AWS_PROFILE).toBe('prod')
        expect(spec.emptyEnv).toBeUndefined()
        expect(spec.timeoutMs).toBe(KubeconfigExecService.DefaultTimeoutMs)

        const execInfo = JSON.parse(spec.env?.KUBERNETES_EXEC_INFO ?? '{}')
        expect(execInfo.kind).toBe('ExecCredential')
        expect(execInfo.spec.interactive).toBe(false)
        expect(execInfo.spec.cluster.server).toBe('https://eks.example.internal:6443')
    })

    it('forwards empty-string exec env values through emptyEnv instead of env', async () => {
        collect.mockResolvedValue({
            code: 0,
            stdout: execOutput('fake-token'),
            stderr: '',
        })

        await service.resolve(buildContext({
            env: [
                { name: 'AWS_PROFILE', value: 'prod' },
                { name: 'EMPTY_FLAG', value: '' },
                { name: 'OVERRIDDEN_TO_EMPTY', value: 'initial' },
                { name: 'OVERRIDDEN_TO_EMPTY', value: '' },
                { name: 'OVERRIDDEN_TO_VALUE', value: '' },
                { name: 'OVERRIDDEN_TO_VALUE', value: 'set' },
            ],
        }))

        const spec = collect.mock.calls[0][0]
        expect(spec.env?.AWS_PROFILE).toBe('prod')
        expect(spec.env?.OVERRIDDEN_TO_VALUE).toBe('set')
        expect(spec.env).not.toHaveProperty('EMPTY_FLAG')
        expect(spec.env).not.toHaveProperty('OVERRIDDEN_TO_EMPTY')
        expect(spec.emptyEnv).toEqual(['EMPTY_FLAG', 'OVERRIDDEN_TO_EMPTY'])
    })

    it('caches credentials until 60s before expirationTimestamp and refreshes afterwards', async () => {
        collect
            .mockResolvedValueOnce({
                code: 0,
                stdout: execOutput('fake-token-1', '2026-06-01T12:10:00Z'),
                stderr: '',
            })
            .mockResolvedValueOnce({
                code: 0,
                stdout: execOutput('fake-token-2', '2026-06-01T12:20:00Z'),
                stderr: '',
            })

        const context = buildContext()
        const first = await service.resolve(context)
        vi.advanceTimersByTime(8 * 60_000)
        const cached = await service.resolve(context)

        expect(first.token).toBe('fake-token-1')
        expect(cached.token).toBe('fake-token-1')
        expect(collect).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(60_000)
        const refreshed = await service.resolve(context)

        expect(refreshed.token).toBe('fake-token-2')
        expect(collect).toHaveBeenCalledTimes(2)
    })

    it('does not cache credentials without an expirationTimestamp', async () => {
        collect
            .mockResolvedValueOnce({ code: 0, stdout: execOutput('fake-token-a'), stderr: '' })
            .mockResolvedValueOnce({ code: 0, stdout: execOutput('fake-token-b'), stderr: '' })

        const context = buildContext()
        expect((await service.resolve(context)).token).toBe('fake-token-a')
        expect((await service.resolve(context)).token).toBe('fake-token-b')
        expect(collect).toHaveBeenCalledTimes(2)
    })

    it('clears cached credentials when forget is called', async () => {
        collect
            .mockResolvedValueOnce({
                code: 0,
                stdout: execOutput('fake-token-1', '2026-06-01T12:30:00Z'),
                stderr: '',
            })
            .mockResolvedValueOnce({
                code: 0,
                stdout: execOutput('fake-token-2', '2026-06-01T12:45:00Z'),
                stderr: '',
            })

        const context = buildContext()
        await service.resolve(context)
        service.forget('eks-prod')
        const fresh = await service.resolve(context)

        expect(fresh.token).toBe('fake-token-2')
        expect(collect).toHaveBeenCalledTimes(2)
    })

    it('resolves relative command paths with a slash against the kubeconfig directory and expands tilde paths', async () => {
        collect.mockResolvedValue({ code: 0, stdout: execOutput('fake-token'), stderr: '' })

        await service.resolve(buildContext({ command: './bin/auth-plugin' }, 'D:/work/clusters/prod.yaml'))
        expect(collect.mock.calls[0][0].command).toBe('D:/work/clusters/bin/auth-plugin')

        await service.resolve(buildContext({ command: '~/bin/auth-plugin' }, 'D:/work/clusters/prod.yaml'))
        expect(collect.mock.calls[1][0].command).toBe('C:/Users/tester/bin/auth-plugin')

        await service.resolve(buildContext({ command: '/usr/local/bin/kubelogin' }, 'D:/work/clusters/prod.yaml'))
        expect(collect.mock.calls[2][0].command).toBe('/usr/local/bin/kubelogin')
    })

    it('refuses interactiveMode Always without spawning a process', async () => {
        const err = await service.resolve(buildContext({ interactiveMode: 'Always' })).catch(e => e)

        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).message).toContain('non-interactively')
        expect(collect).not.toHaveBeenCalled()
    })

    it('includes installHint and sanitized stderr on non-zero exit without leaking tokens', async () => {
        collect.mockResolvedValue({
            code: 1,
            stdout: '',
            stderr: 'SSO session expired token=fake-leaked-secret\nmore lines',
        })

        const err = await service.resolve(buildContext({
            installHint: 'Run aws sso login --profile prod',
        })).catch(e => e)

        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).message).toContain('exited with code 1')
        expect((err as ApiError).details).toContain('SSO session expired')
        expect((err as ApiError).details).toContain('Run aws sso login --profile prod')
        expect(`${(err as ApiError).message} ${(err as ApiError).details}`).not.toContain('fake-leaked-secret')
    })

    it('surfaces installHint when the process fails to start and handles timeout and unavailable runtime', async () => {
        collect.mockRejectedValueOnce(new ApiError('Could not run gke-gcloud-auth-plugin', 'executable file not found'))

        const missingErr = await service.resolve(buildContext({
            command: 'gke-gcloud-auth-plugin',
            installHint: 'Install gke-gcloud-auth-plugin via gcloud components install',
        })).catch(e => e)
        expect(missingErr).toBeInstanceOf(ApiError)
        expect((missingErr as ApiError).details).toContain('Install gke-gcloud-auth-plugin')

        collect.mockResolvedValueOnce({ code: ProcessCollector.expiredCode, stdout: '', stderr: '' })
        const timeoutErr = await service.resolve(buildContext()).catch(e => e)
        expect(timeoutErr).toBeInstanceOf(ApiError)
        expect((timeoutErr as ApiError).message).toContain('timed out')

        collect.mockResolvedValueOnce({ code: ProcessAdapter.unavailableCode, stdout: '', stderr: '' })
        const offlineErr = await service.resolve(buildContext()).catch(e => e)
        expect(offlineErr).toBeInstanceOf(ApiError)
        expect((offlineErr as ApiError).message).toContain('desktop application')
    })
})
