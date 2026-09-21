import { NodeShellDefaults } from '@/application/services/nodeShell/constants/NodeShellDefaults'
import type { TNodeShellPod } from '@/application/services/nodeShell/types/TNodeShellPod'
import { NodeShellCommand } from '@/domain/models/terminal'

export class NodeShellManifest {
    public static nameFor(nodeName: string, token: string): string {
        const slug = nodeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        const suffix = token.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || '0'
        const room = NodeShellDefaults.maxNameLength - `${NodeShellDefaults.componentValue}--${suffix}`.length

        return `${NodeShellDefaults.componentValue}-${slug.slice(0, Math.max(room, 1))}-${suffix}`
    }

    public static selector(): string {
        return `${NodeShellDefaults.managedByLabel}=${NodeShellDefaults.managedByValue},`
            + `${NodeShellDefaults.componentLabel}=${NodeShellDefaults.componentValue}`
    }

    public static labels(nodeName: string): Record<string, string> {
        return {
            [NodeShellDefaults.managedByLabel]: NodeShellDefaults.managedByValue,
            [NodeShellDefaults.componentLabel]: NodeShellDefaults.componentValue,
            [NodeShellDefaults.nodeLabel]: nodeName.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 63),
        }
    }

    public static document(pod: TNodeShellPod): Record<string, unknown> {
        return {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: {
                name: pod.name,
                namespace: pod.namespace,
                labels: NodeShellManifest.labels(pod.nodeName),
            },
            spec: {
                nodeName: pod.nodeName,
                hostPID: true,
                hostIPC: true,
                hostNetwork: true,
                restartPolicy: 'Never',
                terminationGracePeriodSeconds: 0,
                activeDeadlineSeconds: NodeShellDefaults.deadlineSeconds,
                tolerations: [{ operator: 'Exists' }],
                containers: [{
                    name: NodeShellDefaults.containerName,
                    image: pod.image,
                    imagePullPolicy: 'IfNotPresent',
                    command: NodeShellCommand.argv(),
                    stdin: true,
                    // stdinOnce ends the shell the moment the attach drops, so a crash of
                    // this application cannot leave a privileged process running on the node.
                    stdinOnce: true,
                    tty: true,
                    securityContext: { privileged: true },
                }],
            },
        }
    }
}
