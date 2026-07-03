import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

const ArtifactManager = dynamic(
  () => import("@/components/spec/artifact-manager").then((mod) => mod.ArtifactManager),
  { loading: () => <div className="h-[600px] animate-pulse rounded-lg bg-muted" /> }
)

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ projectId: string; artifactType: string }>
}) {
  const { projectId, artifactType } = await params

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
          <h1 className="text-3xl font-bold tracking-tight capitalize">
            {artifactType.replace("_", " ")} Specification
          </h1>
          <p className="text-muted-foreground">
            View or edit the generated artifact.
          </p>
        </div>
      </div>

      <ArtifactManager projectId={projectId} artifactType={artifactType} />
    </div>
  )
}
