"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"

import { ScrollArea } from "@/components/ui/scroll-area"

interface ArtifactViewerProps {
  content: string
}

export function ArtifactViewer({ content }: ArtifactViewerProps) {
  if (!content) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
        No content available.
      </div>
    )
  }

  return (
    <ScrollArea className="h-[600px] w-full rounded-md border p-6">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </ScrollArea>
  )
}
