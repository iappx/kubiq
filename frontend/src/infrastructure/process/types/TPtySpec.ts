export type TPtySpec = {
    command: string
    args: readonly string[]
    env?: Record<string, string>
    dir?: string
    cols?: number
    rows?: number
}
