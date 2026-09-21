export class ObjectHelper {
    public static flattenObject<T extends {}>(obj: T, prefix: string = ''): Record<string, any> {
        const result: Record<string, any> = {}

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key]
                const newKey = prefix ? `${prefix}.${key}` : key

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    Object.assign(result, this.flattenObject(value, newKey))
                } else {
                    result[newKey] = value
                }
            }
        }

        return result
    }
}
