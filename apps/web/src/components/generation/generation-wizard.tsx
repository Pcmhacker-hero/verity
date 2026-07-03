"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { generatePipelineSchema } from "@verity/shared/validation"
import { Loader2, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"

// Schema imported from @verity/shared/validation

interface GenerationWizardProps {
  projectId: string
}

export function GenerationWizard({ projectId }: GenerationWizardProps) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = React.useState(false)

  const form = useForm<z.infer<typeof generatePipelineSchema>>({
    resolver: zodResolver(generatePipelineSchema),
    defaultValues: {
      ideaText: "",
    },
  })

  async function onSubmit(_values: z.infer<typeof generatePipelineSchema>) {
    setIsGenerating(true)
    try {
      // TODO: Connect to actual backend generation endpoint once implemented
      // The instruction "Do not modify backend code" restricts us from creating the endpoint now.
      // Simulating a long-running generation task:
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Navigate to the PRD spec view after successful "generation"
      router.push(`/projects/${projectId}/spec/prd`)
    } catch (_error) {
      form.setError("root", {
        message: "Generation failed. Please try again.",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Generate Project Specification</CardTitle>
        <CardDescription>
          Describe your idea in plain English. Verity&apos;s AI will generate a
          comprehensive PRD, architecture, and schema for your project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="ideaText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Idea</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="I want to build a social network for dog owners. Users can create profiles for their dogs, post pictures, and find nearby playdates..."
                      className="min-h-[200px] resize-none"
                      disabled={isGenerating}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Specifications...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Magic
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      {isGenerating && (
        <CardFooter className="justify-center border-t bg-muted/50 py-4">
          <p className="text-sm text-muted-foreground animate-pulse">
            This may take a minute. Please don&apos;t close this page.
          </p>
        </CardFooter>
      )}
    </Card>
  )
}
