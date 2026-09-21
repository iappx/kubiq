export type TKubeContainerState = {
    running?: {
        /** RFC 3339 timestamp. */
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
        /** RFC 3339 timestamp. */
        startedAt?: string
        /** RFC 3339 timestamp. */
        finishedAt?: string
    }
}
