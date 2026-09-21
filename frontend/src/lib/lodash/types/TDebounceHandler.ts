export type TDebounceHandler<TReturn> = (((...arg: any[]) => TReturn) & { cancel: () => void })
