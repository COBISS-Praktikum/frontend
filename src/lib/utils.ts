import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function stripLanguageTag(value?: string | null): string {
  if (!value) {
    return ''
  }

  return value.replace(/@[a-z]{2}(?:-[a-z0-9]+)?$/i, '')
}
