import type { TPodLogOptions } from '@/domain/models/kube/logs/types/TPodLogOptions'

export class PodLogOptions {
    public static readonly defaultTailLines: number = 500

    public static defaults(container: string = '', previous: boolean = false): TPodLogOptions {
        return {
            container,
            follow: !previous,
            previous,
            timestamps: false,
            tailLines: PodLogOptions.defaultTailLines,
            sinceSeconds: 0,
            sinceTime: '',
        }
    }

    // A terminated container has nothing left to follow, so previous and follow are mutually exclusive.
    public static forPrevious(options: TPodLogOptions, previous: boolean): TPodLogOptions {
        return { ...options, previous, follow: previous ? false : options.follow }
    }

    public static sameSource(left: TPodLogOptions, right: TPodLogOptions): boolean {
        return left.container === right.container
            && left.previous === right.previous
            && left.follow === right.follow
            && left.timestamps === right.timestamps
            && left.tailLines === right.tailLines
            && left.sinceSeconds === right.sinceSeconds
            && left.sinceTime === right.sinceTime
    }
}
