import * as React from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Settings, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to projects</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Overview</h1>
          <p className="text-muted-foreground">ID: {projectId}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/projects/${projectId}/settings`}>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Link href={`/projects/${projectId}/chat`}>
            <Button variant="outline">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Button>
          </Link>
          <Link href={`/projects/${projectId}/generate`}>
            <Button>Generate Spec</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Verification Status
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Never Run</div>
            <p className="text-xs text-muted-foreground">
              Run verification to check your code.
            </p>
          </CardContent>
        </Card>
        
        {/* We can add more cards for Spec Summary, Repo connection, etc. */}
      </div>
    </div>
  )
}
