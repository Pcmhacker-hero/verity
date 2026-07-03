"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"

import { signOut, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function Header() {
  const router = useRouter()
  const { data: session } = useSession()

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{session?.user?.name || session?.user?.email || "User"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
