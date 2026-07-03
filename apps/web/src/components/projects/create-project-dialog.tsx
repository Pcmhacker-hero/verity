"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateProject } from "@/hooks/use-projects"
import { useGithubRepos } from "@/hooks/use-github"

const formSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  githubRepoFullName: z.string().optional(),
})

export function CreateProjectDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const { mutateAsync: createProject, isPending } = useCreateProject()
  const { data: githubData, isLoading: isLoadingGithub } = useGithubRepos()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await createProject({
        name: values.name,
        githubRepoFullName: values.githubRepoFullName,
      })
      form.reset()
      setOpen(false)
    } catch {
      form.setError("root", {
        message: "Failed to create project. Please try again.",
      })
    }
  }

  const handleRepoChange = (value: string) => {
    form.setValue("githubRepoFullName", value)
    if (!form.getValues("name")) {
      const repoName = value.split("/")[1]
      if (repoName) {
        form.setValue("name", repoName)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>Create Project</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Create a new Verity project or import a repository from GitHub.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {!isLoadingGithub && githubData?.connected && (
              <FormField
                control={form.control}
                name="githubRepoFullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Import from GitHub (Optional)</FormLabel>
                    <Select onValueChange={handleRepoChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a repository" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {githubData.repos.map((repo) => (
                          <SelectItem key={repo.id} value={repo.full_name}>
                            {repo.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isLoadingGithub && !githubData?.connected && (
              <div className="text-sm text-muted-foreground pb-2">
                <Link href="/settings" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                  Connect GitHub
                </Link>{" "}
                to import repositories.
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Authentication Service" {...field} />
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
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
