export class ContainerWaitingReasonCatalog {
    public static readonly values: Record<string, string> = {
        ContainerCreating: 'Creating container',
        PodInitializing: 'Initializing pod',
        CrashLoopBackOff: 'Crash loop back-off',
        ImagePullBackOff: 'Image pull back-off',
        ErrImagePull: 'Image pull failed',
        ErrImageNeverPull: 'Image not present locally',
        InvalidImageName: 'Invalid image name',
        CreateContainerConfigError: 'Container config error',
        CreateContainerError: 'Container creation failed',
        RunContainerError: 'Container failed to start',
    }

    private static readonly transient: string[] = ['ContainerCreating', 'PodInitializing']

    public static title(reason: string): string {
        return ContainerWaitingReasonCatalog.values[reason] ?? reason
    }

    public static has(reason: string): boolean {
        return Object.prototype.hasOwnProperty.call(ContainerWaitingReasonCatalog.values, reason)
    }

    // An unknown reason counts as an error: apart from the transient ones, the kubelet reports one only while a container fails to start.
    public static isError(reason: string): boolean {
        return !ContainerWaitingReasonCatalog.transient.includes(reason)
    }
}
