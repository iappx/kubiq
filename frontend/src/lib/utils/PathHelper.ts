export class PathHelper {
    public static resolvePath<TRes>(path: PropertyKey | PropertyKey[], obj: Record<PropertyKey, any> | any, separator = '.'): TRes {
        const properties = Array.isArray(path) ? path : path.toString().split(separator)
        return properties.reduce((prev, curr) => prev && prev[curr], obj)
    }

    public static setValue(path: string | string[], obj: Record<string, any>, value: any, separator = '.'): void {
        const properties = Array.isArray(path) ? path : path.split(separator)
        let result = obj
        for (let i = 0; i < properties.length - 1; i++) {
            const property = properties[i]
            if (!result[property]) {
                result[property] = {}
            }
            result = result[property]
        }
        const lastProperty = properties[properties.length - 1]
        result[lastProperty] = value
    }
}
