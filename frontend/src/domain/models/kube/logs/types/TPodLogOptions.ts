export type TPodLogOptions = {
    container: string
    follow: boolean
    previous: boolean
    timestamps: boolean
    // 0 asks for the whole log the cluster still holds, not for no lines.
    tailLines: number
    // 0 means no time limit.
    sinceSeconds: number
    // Takes precedence over sinceSeconds when set.
    sinceTime: string
}
