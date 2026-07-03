import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GenerationWizard } from "@/components/generation/generation-wizard"

export default async function GenerateSpecPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to project</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Spec</h1>
          <p className="text-muted-foreground">
            Use AI to generate your Verity artifacts.
          </p>
        </div>
      </div>
      
      <div className="mt-8">
        <GenerationWizard projectId={projectId} />
      </div>
    </div>
  )
}
