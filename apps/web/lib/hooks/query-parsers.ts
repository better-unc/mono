export function parseAsStringLiteral<T extends string>(options: readonly T[]) {
  return {
    parse: (value: string | null): T | null => (options.includes(value as T) ? (value as T) : null),
    serialize: (value: T) => value,
    withDefault: (defaultValue: T) => ({
      parse: (value: string | null): T => (options.includes(value as T) ? (value as T) : defaultValue),
      serialize: (value: T) => value,
      defaultValue,
    }),
  };
}

export const parseAsInteger = {
  parse: (value: string | null) => (value ? parseInt(value, 10) : null),
  serialize: (value: number) => String(value),
  withDefault: (defaultValue: number) => ({
    parse: (value: string | null) => (value ? parseInt(value, 10) : defaultValue),
    serialize: (value: number) => String(value),
    defaultValue,
  }),
};

export const parseAsString = {
  parse: (value: string | null) => value,
  serialize: (value: string | null) => value,
  withDefault: (defaultValue: string) => ({
    parse: (value: string | null) => value ?? defaultValue,
    serialize: (value: string) => value,
    defaultValue,
  }),
};
