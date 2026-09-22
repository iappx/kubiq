export class HelmLimits {
    public static readonly maxReleases: number = 500

    public static readonly maxOutputLines: number = 2000

    // One helm per namespace in scope is one child process, not one HTTP request.
    public static readonly maxParallelScopes: number = 6
}
