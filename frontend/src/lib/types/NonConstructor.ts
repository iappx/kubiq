// Mapped types drop the construct signature, which is exactly the point here:
// what is left is the static side of a class.
export type NonConstructor<T> = { [K in keyof T]: T[K] }
