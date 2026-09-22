export class ArgoRevision {
    public static readonly shortLength: number = 7

    private static readonly commit: RegExp = /^[0-9a-f]{40}$/i

    // A Helm chart revision is a version and has to stay whole; only a git commit is abbreviated.
    public static short(revision: string): string {
        return ArgoRevision.isCommit(revision) ? revision.slice(0, ArgoRevision.shortLength) : revision
    }

    public static isCommit(revision: string): boolean {
        return ArgoRevision.commit.test(revision)
    }
}
