"use client"

import * as React from "react"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"

interface ArtifactEditorProps {
  initialContent: string
  onSave: (content: string) => Promise<void>
}

export function ArtifactEditor({ initialContent, onSave }: ArtifactEditorProps) {
  const [content, setContent] = React.useState(initialContent)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(content)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save artifact.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full w-full">
      {error && (
        <div className="text-sm font-medium text-destructive">{error}</div>
      )}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[500px] flex-1 font-mono text-sm resize-none"
        placeholder="Write or edit the specification markdown here..."
        disabled={isSaving}
      />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || content === initialContent}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
