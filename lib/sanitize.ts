const controlCharsPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const controlCharsGlobalPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const unsafeMarkupPattern = /<|>|javascript:|on\w+\s*=|<\/?\s*(script|iframe|object|embed|style|link|meta)\b/i;

export const genericActionError = "No se pudo completar la accion. Intenta nuevamente.";
export const unsafeInputError = "No ingreses caracteres o codigo no permitido.";

export function hasUnsafeContent(value: string) {
  return controlCharsPattern.test(value) || unsafeMarkupPattern.test(value);
}

export function sanitizeText(value: string, maxLength = 120) {
  return value
    .replace(controlCharsGlobalPattern, " ")
    .replace(/[<>]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export function sanitizeEmail(value: string) {
  return sanitizeText(value, 120).toLowerCase();
}

export function sanitizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function sanitizeBio(value: string) {
  return sanitizeText(value, 250);
}

export function sanitizeComment(value: string) {
  return sanitizeText(value, 300);
}
