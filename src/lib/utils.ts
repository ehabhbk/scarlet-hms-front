import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isPermissionGranted(permissions: string[] | undefined, permission: string): boolean {
  return Boolean(permissions?.includes(permission))
}

export function isAnyPermissionGranted(permissions: string[] | undefined, required: string[]): boolean {
  return required.some((permission) => permissions?.includes(permission))
}
