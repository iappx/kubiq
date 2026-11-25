export type TLaunchSpec = {
    path: string
    args: string[]
    env?: Record<string, string>
    dir?: string
}
