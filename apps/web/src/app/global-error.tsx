"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Caught:", error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold tracking-tight">
            Critical System Error
          </h1>
          <p className="mb-6 text-muted-foreground max-w-[500px]">
            We encountered an unexpected problem. Please try refreshing the page.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
            <Button variant="outline" onClick={() => reset()}>
              Try to Recover
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
