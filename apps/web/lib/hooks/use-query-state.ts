import { useCallback, useState, useEffect } from "react";

type Parser<T> = {
  parse: (value: string | null) => T;
  serialize: (value: T) => string | null;
  defaultValue?: T;
};

const defaultStringParser: Parser<string | null> = {
  parse: (value: string | null) => value,
  serialize: (value: string | null) => value,
  defaultValue: null,
};

function getSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

function setSearchParam(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  
  if (value === null) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
  window.history.replaceState(window.history.state, "", newUrl);
}

export function useQueryState(key: string): [string | null, (value: string | null) => void];
export function useQueryState<T>(key: string, parser: Parser<T>): [T, (value: T | null) => void];
export function useQueryState<T>(
  key: string,
  parser?: Parser<T>,
): [T | string | null, (value: T | string | null) => void] {
  const actualParser = parser ?? (defaultStringParser as Parser<T>);
  
  const getInitialValue = () => {
    const rawValue = getSearchParam(key);
    return actualParser.parse(rawValue) ?? actualParser.defaultValue;
  };

  const [value, setValueState] = useState<T | string | null>(getInitialValue);

  useEffect(() => {
    const rawValue = getSearchParam(key);
    const parsed = actualParser.parse(rawValue) ?? actualParser.defaultValue;
    setValueState(parsed as T);
  }, [key, actualParser]);

  useEffect(() => {
    const handlePopState = () => {
      const rawValue = getSearchParam(key);
      const parsed = actualParser.parse(rawValue) ?? actualParser.defaultValue;
      setValueState(parsed as T);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [key, actualParser]);

  const setValue = useCallback(
    (newValue: T | null) => {
      const serialized = newValue === null ? null : actualParser.serialize(newValue);
      const shouldRemove = serialized === null || 
        (actualParser.defaultValue !== undefined && serialized === actualParser.serialize(actualParser.defaultValue));
      
      setSearchParam(key, shouldRemove ? null : serialized);
      setValueState(newValue === null ? (actualParser.defaultValue as T) : newValue);
    },
    [key, actualParser],
  );

  return [value as T, setValue];
}
