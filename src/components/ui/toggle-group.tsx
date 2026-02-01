"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"

import { cn } from "@/lib/utils"

const ToggleGroupContext = React.createContext<{
  size?: "default" | "sm" | "lg"
  variant?: "default" | "outline"
}>({
  size: "default",
  variant: "default",
})

function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "flex items-center rounded-md",
        "data-[variant=outline]:border data-[variant=outline]:border-input",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}) {
  const context = React.useContext(ToggleGroupContext)
  const resolvedVariant = variant || context.variant || "default"
  const resolvedSize = size || context.size || "default"

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
        "hover:bg-muted hover:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        resolvedVariant === "outline" && "border-0 first:rounded-l-md last:rounded-r-md",
        resolvedSize === "default" && "h-10 px-3",
        resolvedSize === "sm" && "h-9 px-2.5",
        resolvedSize === "lg" && "h-11 px-5",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
