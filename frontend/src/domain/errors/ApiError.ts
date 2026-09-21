// Every API failure is a business error: the user is told, and the text they
// read is written here rather than by whoever catches it.
export class ApiError extends Error {
    public static readonly DefaultMessage = 'The application request failed'

    /** Technical detail shown under the message — never the whole story on its own. */
    public readonly details?: string

    constructor(message: string = ApiError.DefaultMessage, details?: string) {
        super(message)
        this.name = 'ApiError'
        this.details = details
    }
}
