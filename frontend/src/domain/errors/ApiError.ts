export class ApiError extends Error {
    public static readonly DefaultMessage = 'The application request failed'

    public readonly details?: string

    public readonly status?: number

    constructor(message: string = ApiError.DefaultMessage, details?: string, status?: number) {
        super(message)
        this.name = 'ApiError'
        this.details = details
        this.status = status
    }

    public static statusOf(error: unknown): number | undefined {
        return error instanceof ApiError ? error.status : undefined
    }
}
