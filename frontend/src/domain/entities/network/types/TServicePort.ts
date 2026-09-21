export type TServicePort = {
    name?: string
    port: number
    protocol?: string
    nodePort?: number
    targetPort?: string | number
}
