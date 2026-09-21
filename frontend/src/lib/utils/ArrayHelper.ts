import { PathHelper } from '@/lib/utils/PathHelper'

export class ArrayHelper {
    static createMap<TArray>(array: Array<TArray>, key: string): Record<string, TArray> {
        const res: Record<string, any> = {}
        for (let i = 0; i < array.length; i++) {
            const arrayKeyValue = PathHelper.resolvePath<string>(key, array[i])
            res[arrayKeyValue] = array[i]
        }
        return res
    }

    static createDictionary<TArray extends Record<string, any>>(array: Array<TArray>, key: string): Record<string, Array<TArray>> {
        const res: Record<string, Array<TArray>> = {}
        for (let i = 0; i < array.length; i++) {
            const arrayKeyValue = PathHelper.resolvePath<string>(key, array[i])
            if (!res[arrayKeyValue]) {
                res[arrayKeyValue] = []
            }
            res[arrayKeyValue].push(array[i])
        }
        return res
    }
}
