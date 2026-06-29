import { ZodError } from "zod";

export function formatZodErrors(error: ZodError) {
  return error.errors.map((err) => ({
    path: err.path.join("."),
    message: err.message,
  }));
}
