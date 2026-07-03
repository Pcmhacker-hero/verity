"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckCircle2, Folder, LayoutDashboard, Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export const navItems = [
  {
    title: "Projects",
    href: "/projects",
    icon: Folder,
  },
  {
    title: "Verification",
    href: "/verification",
    icon: CheckCircle2,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <div className={cn("flex h-full w-[240px] flex-col border-r bg-muted/40", className)}>
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Verity</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href) || (pathname === '/' && item.href === '/projects')
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn("w-full justify-start gap-3 transition-all", {
                    "bg-secondary font-medium shadow-sm": isActive,
                    "text-muted-foreground hover:text-foreground": !isActive
                  })}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.title}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
