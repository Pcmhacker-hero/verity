/**
 * Dashboard Layout — Doc 12 §5 (authenticated shell).
 *
 * Wraps all authenticated routes with:
 * - Sidebar navigation (Doc 12 §5.2)
 * - Header with user info
 * - Auth check (redirect to /login if not authenticated)
 */

import { redirect } from "next/navigation"

import { requireAuthContext } from "@/lib/auth/session"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuthContext()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
