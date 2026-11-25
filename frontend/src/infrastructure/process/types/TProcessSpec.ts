export type TProcessSpec = {
    command: string
    args: readonly string[]
    env?: Record<string, string>
    emptyEnv?: readonly string[]
    dir?: string
    timeoutMs?: number
}
