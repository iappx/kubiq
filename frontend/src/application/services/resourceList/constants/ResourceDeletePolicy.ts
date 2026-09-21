export class ResourceDeletePolicy {
    public static readonly background: string = 'Background'

    public static readonly foreground: string = 'Foreground'

    public static readonly orphan: string = 'Orphan'

    // Sent rather than left to the API server's per-resource default, so the confirmation
    // can state which policy the delete will actually use.
    public static readonly applied: string = ResourceDeletePolicy.background
}
