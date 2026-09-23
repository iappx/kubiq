import { NamingStrategies } from '@iappx/entity-repo'
import type { TRestQueryOptions } from '@iappx/entity-repo-rest'
import { AppEnvironment } from '@/config/AppEnvironment'

export class ReleaseEntitySetOptions {
    public static readonly latestKey: string = 'latest'

    public static releases(): TRestQueryOptions {
        return {
            resource: `/repos/${AppEnvironment.ReleaseRepository}/releases`,
            naming: NamingStrategies.snakeCase,
        }
    }
}
