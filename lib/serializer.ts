/**
 * Utility to serialize/deserialize data for Server Components to Client Components
 * Converts Date objects to ISO strings for safe serialization
 */

export function serializeData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const serialized: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = (data as Record<string, unknown>)[key];
        if (value instanceof Date) {
          serialized[key] = value.toISOString();
        } else if (Array.isArray(value)) {
          serialized[key] = value.map(item => serializeData(item));
        } else if (typeof value === 'object' && value !== null) {
          serialized[key] = serializeData(value);
        } else {
          serialized[key] = value;
        }
      }
    }
    return serialized as unknown as T;
  }

  return data;
}

export function deserializeData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(data)) {
    return new Date(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => deserializeData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const deserialized: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = (data as Record<string, unknown>)[key];
        deserialized[key] = deserializeData(value);
      }
    }
    return deserialized as unknown as T;
  }

  return data;
}
