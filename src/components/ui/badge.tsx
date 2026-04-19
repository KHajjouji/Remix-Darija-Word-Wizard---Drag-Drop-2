import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
  className?: string
  children?: React.ReactNode
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-blue-600 text-white shadow hover:bg-blue-600/80": variant === "default",
          "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80": variant === "secondary",
          "border-transparent bg-red-500 text-white shadow hover:bg-red-500/80": variant === "destructive",
          "text-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
