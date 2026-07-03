"use client"

import * as React from "react"
import Link from "next/link"
import { Activity, ArrowUpRight, CheckCircle2, Clock, Folder, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// Dummy data for visual representation until hooked to API
const stats = [
  {
    title: "Total Projects",
    value: "12",
    description: "+2 from last month",
    icon: Folder,
  },
  {
    title: "Active Verifications",
    value: "4",
    description: "2 in progress",
    icon: Activity,
  },
  {
    title: "Success Rate",
    value: "98.2%",
    description: "+0.5% from last week",
    icon: CheckCircle2,
  },
  {
    title: "Team Members",
    value: "8",
    description: "3 active now",
    icon: Users,
  },
]

const recentActivity = [
  { id: 1, action: "Verification passed", project: "Auth Service API", time: "2 hours ago", status: "success" },
  { id: 2, action: "Blueprint generated", project: "Payment Gateway", time: "4 hours ago", status: "neutral" },
  { id: 3, action: "Verification failed", project: "User Dashboard", time: "5 hours ago", status: "destructive" },
  { id: 4, action: "Project created", project: "Inventory System", time: "1 day ago", status: "neutral" },
]

export default function DashboardHome() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back. Here's an overview of your verification projects.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>
              You have 12 total projects in your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Empty state simulation if data is empty, but we show data here */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="group flex flex-col justify-between rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                  <div className="space-y-2">
                    <h3 className="font-semibold leading-none tracking-tight">Project Alpha {i}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      Core verification blueprint for the new authentication microservice architecture.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      Updated 2d ago
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <Button variant="outline" asChild>
                <Link href="/projects">View all projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest verification and generation events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center">
                  <span className="relative flex h-2 w-2 mr-4 shrink-0 rounded-full bg-primary" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {activity.action}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.project} • {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
