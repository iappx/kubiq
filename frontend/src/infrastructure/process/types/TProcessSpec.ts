export type TProcessSpec = {
    command: string
    args: readonly string[]
    env?: Record<string, string>
    dir?: string
    timeoutMs?: number
}
