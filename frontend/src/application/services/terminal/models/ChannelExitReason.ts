export class ChannelExitReason {
    public static readonly success: string = 'Success'

    // A clean exit sends a Status document too, so an empty answer is a result, not a gap.
    public static text(reason: string): string {
        const trimmed = reason.trim()
        if (trimmed === '') {
            return ''
        }

        const status = ChannelExitReason.parse(trimmed)
        if (!status) {
            return trimmed
        }
        if (status.status === ChannelExitReason.success) {
            return ''
        }

        return typeof status.message === 'string' && status.message !== '' ? status.message : trimmed
    }

    private static parse(reason: string): { status?: string, message?: string } | null {
        try {
            const parsed: unknown = JSON.parse(reason)

            return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as { status?: string, message?: string }
                : null
        } catch {
            return null
        }
    }
}
