"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-slate-950 dark:group-[.toaster]:text-slate-50 dark:group-[.toaster]:border-slate-800",
          description: "group-[.toast]:text-slate-500 dark:group-[.toast]:text-slate-400",
          actionButton:
            "group-[.toast]:bg-slate-900 group-[.toast]:text-slate-50 dark:group-[.toast]:bg-slate-50 dark:group-[.toast]:text-slate-900",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500 dark:group-[.toast]:bg-slate-800 dark:group-[.toast]:text-slate-400",
          error:
            "group toast group-[.toaster]:bg-red-500 group-[.toaster]:text-white group-[.toaster]:border-red-600 dark:group-[.toaster]:bg-red-900 dark:group-[.toaster]:border-red-800",
          success:
            "group toast group-[.toaster]:bg-green-500 group-[.toaster]:text-white group-[.toaster]:border-green-600 dark:group-[.toaster]:bg-green-900 dark:group-[.toaster]:border-green-800",
          warning:
            "group toast group-[.toaster]:bg-amber-500 group-[.toaster]:text-white group-[.toaster]:border-amber-600 dark:group-[.toaster]:bg-amber-900 dark:group-[.toaster]:border-amber-800",
          info:
            "group toast group-[.toaster]:bg-blue-500 group-[.toaster]:text-white group-[.toaster]:border-blue-600 dark:group-[.toaster]:bg-blue-900 dark:group-[.toaster]:border-blue-800",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
