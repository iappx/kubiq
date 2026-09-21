// Not a no-op: a mapped type drops the construct signature, leaving the static side.
export type NonConstructor<T> = { [K in keyof T]: T[K] }
