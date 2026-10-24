"use client"

import * as React from "react"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

/*
 * One tab style for the whole CRM: the segmented control first used for the
 * contact list views. A grey track holds the options; the selected one is a
 * white tile with a hairline ring. Shared by Radix Tabs (panels) and the
 * Segmented control (filters/categories) so they can never drift apart.
 */
export const tabListClass =
  "inline-flex max-w-full items-center gap-0.5 self-start overflow-x-auto rounded-lg bg-secondary p-1 [scrollbar-width:none]"
export const tabTriggerClass =
  "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
export const tabTriggerActiveClass = "bg-card text-foreground ring-1 ring-border"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn(tabListClass, className)} {...props} />
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabTriggerClass, "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:ring-1 data-[state=active]:ring-border", className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 text-sm outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
