import type { Result } from "@/lib/types";
import { createId } from "@/lib/utils/id";

export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const forbidden = (message = "You don't have permission to do that."): Result<never> => ({ ok: false, error: message, code: "forbidden" });
export const notFound = (message = "That record no longer exists."): Result<never> => ({ ok: false, error: message, code: "not_found" });
export const invalid = (message: string): Result<never> => ({ ok: false, error: message, code: "invalid" });
export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) => createId(prefix);
