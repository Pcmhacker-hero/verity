"use client"

import { useState } from "react"
import { Github } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

export function GithubSettings() {
  const [isLinking, setIsLinking] = useState(false)
  
  const handleConnect = async () => {
    setIsLinking(true)
    try {
      await authClient.linkSocial({
        provider: "github",
        callbackURL: "/settings",
      })
    } catch (error) {
      console.error("Failed to connect GitHub:", error)
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Integration</CardTitle>
        <CardDescription>
          Connect your GitHub account to import repositories and sync code automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Github className="h-8 w-8" />
            <div>
              <p className="text-sm font-medium leading-none">GitHub Account</p>
              <p className="text-sm text-muted-foreground mt-1">
                Link your account to access your repositories.
              </p>
            </div>
          </div>
          <Button onClick={handleConnect} disabled={isLinking} variant="outline">
            {isLinking ? "Connecting..." : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
