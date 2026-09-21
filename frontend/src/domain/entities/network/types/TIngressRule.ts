export type TIngressRule = {
    host?: string
    http?: {
        paths?: {
            path?: string
            pathType?: string
            backend?: {
                service?: {
                    name?: string
                    port?: {
                        name?: string
                        number?: number
                    }
                }
            }
        }[]
    }
}
