export type TKubeContainerState = {
    running?: {
        startedAt?: string
    }
    waiting?: {
        reason?: string
        message?: string
    }
    terminated?: {
        reason?: string
        message?: string
        exitCode?: number
        signal?: number
        startedAt?: string
        finishedAt?: string
    }
}
