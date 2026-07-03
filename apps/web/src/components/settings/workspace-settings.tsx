"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2, Save } from "lucide-react"
import { updateWorkspaceSchema } from "@verity/shared/validation"

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useWorkspace, useUpdateWorkspace } from "@/hooks/use-workspace"

// Schema imported from @verity/shared/validation

export function WorkspaceSettings() {
  const { data: workspace, isLoading, error } = useWorkspace()
  const { mutateAsync: updateWorkspace, isPending } = useUpdateWorkspace()
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  const form = useForm<z.infer<typeof updateWorkspaceSchema>>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: {
      name: "",
    },
  })

  // Reset form when workspace data loads
  React.useEffect(() => {
    if (workspace) {
      form.reset({
        name: workspace.name,
      })
    }
  }, [workspace, form])

  async function onSubmit(values: z.infer<typeof updateWorkspaceSchema>) {
    setSuccessMessage(null)
    try {
      await updateWorkspace({ name: values.name })
      setSuccessMessage("Workspace settings updated successfully.")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (_error) {
      form.setError("root", {
        message: "Failed to update workspace. Please try again.",
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
          <CardDescription>Manage your workspace preferences.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
          <CardDescription>Manage your workspace preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm font-medium text-destructive">
            Failed to load workspace data.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Settings</CardTitle>
        <CardDescription>
          Update your workspace name and preferences. This will be visible to all members.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" disabled={isPending} {...field} />
                  </FormControl>
                  <FormDescription>
                    This is your team's workspace name within Verity.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.formState.errors.root && (
              <div className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}
            
            {successMessage && (
              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                {successMessage}
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-muted/50 px-6 py-4">
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? (
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
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
