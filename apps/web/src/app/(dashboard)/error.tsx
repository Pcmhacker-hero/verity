"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex h-[80vh] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-destructive/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold">Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred while loading the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          {error.message || "Our team has been notified and we are looking into it."}
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            Go Home
          </Button>
          <Button onClick={() => reset()}>
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
