import { stringify } from 'yaml'
import type { TResourceDataPair } from '@/application/services/resourceData/types/TResourceDataPair'

export class ResourceDataYaml {
    public static of(pairs: readonly TResourceDataPair[]): string {
        if (pairs.length === 0) {
            return ''
        }

        const map: Record<string, string> = {}
        pairs.forEach((pair) => {
            map[pair.key] = pair.value
        })

        return stringify(map, { indent: 2, lineWidth: 0, blockQuote: 'literal' })
    }
}
