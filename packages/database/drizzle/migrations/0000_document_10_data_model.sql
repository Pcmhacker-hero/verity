CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "membership_role" AS ENUM ('owner', 'admin', 'member');
CREATE TYPE "spec_version_source" AS ENUM ('generation', 'edit', 'regeneration');
CREATE TYPE "http_method" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
CREATE TYPE "verification_run_status" AS ENUM ('queued', 'running_deterministic', 'running_semantic', 'complete', 'failed');
CREATE TYPE "severity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE "spec_area" AS ENUM ('auth', 'schema', 'api_contract', 'architecture', 'other');
CREATE TYPE "detection_tier" AS ENUM ('deterministic', 'semantic');
CREATE TYPE "finding_status" AS ENUM ('open', 'acknowledged');

CREATE TABLE "user" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "auth_provider_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE ("email")
);

CREATE TABLE "workspace" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "membership" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "membership_role" DEFAULT 'owner' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "membership_workspace_user_unique" UNIQUE ("workspace_id", "user_id"),
  CONSTRAINT "membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE cascade,
  CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade
);

CREATE TABLE "project" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "current_spec_version_id" uuid,
  "repo_connection_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE cascade
);

CREATE TABLE "spec_version" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "source" "spec_version_source" NOT NULL,
  "change_summary" text,
  "previous_version_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "spec_version_project_version_unique" UNIQUE ("project_id", "version_number"),
  CONSTRAINT "spec_version_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE restrict,
  CONSTRAINT "spec_version_previous_version_id_spec_version_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "spec_version"("id") ON DELETE restrict
);

CREATE TABLE "prd_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_version_id" uuid NOT NULL,
  "problem_statement" text NOT NULL,
  "target_users" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "features" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "non_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "success_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "narrative" text DEFAULT '' NOT NULL,
  CONSTRAINT "prd_artifact_spec_version_id_unique" UNIQUE ("spec_version_id"),
  CONSTRAINT "prd_artifact_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE cascade
);

CREATE TABLE "architecture_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_version_id" uuid NOT NULL,
  "components" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "data_flow" jsonb DEFAULT '[]'::jsonb NOT NULL,
  CONSTRAINT "architecture_artifact_spec_version_id_unique" UNIQUE ("spec_version_id"),
  CONSTRAINT "architecture_artifact_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE cascade
);

CREATE TABLE "schema_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_version_id" uuid NOT NULL,
  CONSTRAINT "schema_artifact_spec_version_id_unique" UNIQUE ("spec_version_id"),
  CONSTRAINT "schema_artifact_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE cascade
);

CREATE TABLE "schema_entity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "schema_artifact_id" uuid NOT NULL,
  "name" text NOT NULL,
  "architecture_component_ref" uuid,
  CONSTRAINT "schema_entity_artifact_name_unique" UNIQUE ("schema_artifact_id", "name"),
  CONSTRAINT "schema_entity_schema_artifact_id_schema_artifact_id_fk" FOREIGN KEY ("schema_artifact_id") REFERENCES "schema_artifact"("id") ON DELETE cascade
);

CREATE TABLE "schema_field" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "schema_entity_id" uuid NOT NULL,
  "name" text NOT NULL,
  "data_type" text NOT NULL,
  "is_required" boolean DEFAULT true NOT NULL,
  "is_unique" boolean DEFAULT false NOT NULL,
  "foreign_key_ref" uuid,
  CONSTRAINT "schema_field_entity_name_unique" UNIQUE ("schema_entity_id", "name"),
  CONSTRAINT "schema_field_schema_entity_id_schema_entity_id_fk" FOREIGN KEY ("schema_entity_id") REFERENCES "schema_entity"("id") ON DELETE cascade,
  CONSTRAINT "schema_field_foreign_key_ref_schema_entity_id_fk" FOREIGN KEY ("foreign_key_ref") REFERENCES "schema_entity"("id") ON DELETE restrict
);

CREATE TABLE "api_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_version_id" uuid NOT NULL,
  CONSTRAINT "api_artifact_spec_version_id_unique" UNIQUE ("spec_version_id"),
  CONSTRAINT "api_artifact_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE cascade
);

CREATE TABLE "api_endpoint" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "api_artifact_id" uuid NOT NULL,
  "method" "http_method" NOT NULL,
  "path" text NOT NULL,
  "request_shape" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "response_shape" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "auth_required" boolean NOT NULL,
  "required_role" text,
  "schema_entity_refs" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
  CONSTRAINT "api_endpoint_artifact_method_path_unique" UNIQUE ("api_artifact_id", "method", "path"),
  CONSTRAINT "api_endpoint_api_artifact_id_api_artifact_id_fk" FOREIGN KEY ("api_artifact_id") REFERENCES "api_artifact"("id") ON DELETE cascade
);

CREATE TABLE "repo_structure_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_version_id" uuid NOT NULL,
  "tree" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "repo_structure_artifact_spec_version_id_unique" UNIQUE ("spec_version_id"),
  CONSTRAINT "repo_structure_artifact_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE cascade
);

CREATE TABLE "roadmap_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_version_id" uuid NOT NULL,
  CONSTRAINT "roadmap_artifact_spec_version_id_unique" UNIQUE ("spec_version_id"),
  CONSTRAINT "roadmap_artifact_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE cascade
);

CREATE TABLE "roadmap_phase" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "roadmap_artifact_id" uuid NOT NULL,
  "order" integer NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  CONSTRAINT "roadmap_phase_artifact_order_unique" UNIQUE ("roadmap_artifact_id", "order"),
  CONSTRAINT "roadmap_phase_roadmap_artifact_id_roadmap_artifact_id_fk" FOREIGN KEY ("roadmap_artifact_id") REFERENCES "roadmap_artifact"("id") ON DELETE cascade,
  CONSTRAINT "roadmap_phase_order_positive" CHECK ("order" > 0)
);

CREATE TABLE "task_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_version_id" uuid NOT NULL,
  CONSTRAINT "task_artifact_spec_version_id_unique" UNIQUE ("spec_version_id"),
  CONSTRAINT "task_artifact_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE cascade
);

CREATE TABLE "task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_artifact_id" uuid NOT NULL,
  "roadmap_phase_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "prd_feature_ref" text NOT NULL,
  "architecture_component_ref" uuid NOT NULL,
  "schema_entity_refs" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
  "api_endpoint_refs" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
  CONSTRAINT "task_task_artifact_id_task_artifact_id_fk" FOREIGN KEY ("task_artifact_id") REFERENCES "task_artifact"("id") ON DELETE cascade,
  CONSTRAINT "task_roadmap_phase_id_roadmap_phase_id_fk" FOREIGN KEY ("roadmap_phase_id") REFERENCES "roadmap_phase"("id") ON DELETE restrict
);

CREATE TABLE "repo_connection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "github_repo_full_name" text NOT NULL,
  "oauth_token_ref" text NOT NULL,
  "connected_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "repo_connection_project_id_unique" UNIQUE ("project_id"),
  CONSTRAINT "repo_connection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE cascade
);

CREATE TABLE "verification_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "spec_version_id" uuid NOT NULL,
  "status" "verification_run_status" DEFAULT 'queued' NOT NULL,
  "commit_sha" text,
  "triggered_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  CONSTRAINT "verification_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE cascade,
  CONSTRAINT "verification_run_spec_version_id_spec_version_id_fk" FOREIGN KEY ("spec_version_id") REFERENCES "spec_version"("id") ON DELETE restrict
);

CREATE TABLE "finding" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "verification_run_id" uuid NOT NULL,
  "severity" "severity" NOT NULL,
  "spec_area" "spec_area" NOT NULL,
  "spec_element_ref" text NOT NULL,
  "file_path" text,
  "line_number" integer,
  "explanation" text NOT NULL,
  "detection_tier" "detection_tier" NOT NULL,
  "status" "finding_status" DEFAULT 'open' NOT NULL,
  CONSTRAINT "finding_verification_run_id_verification_run_id_fk" FOREIGN KEY ("verification_run_id") REFERENCES "verification_run"("id") ON DELETE cascade,
  CONSTRAINT "finding_line_number_positive" CHECK ("line_number" IS NULL OR "line_number" > 0)
);

ALTER TABLE "project" ADD CONSTRAINT "project_current_spec_version_id_spec_version_id_fk" FOREIGN KEY ("current_spec_version_id") REFERENCES "spec_version"("id") ON DELETE restrict;
ALTER TABLE "project" ADD CONSTRAINT "project_repo_connection_id_repo_connection_id_fk" FOREIGN KEY ("repo_connection_id") REFERENCES "repo_connection"("id") ON DELETE set null;

CREATE INDEX "idx_project_workspace_updated" ON "project" ("workspace_id", "updated_at");
CREATE INDEX "idx_spec_version_project" ON "spec_version" ("project_id", "version_number");
CREATE INDEX "idx_schema_entity_artifact" ON "schema_entity" ("schema_artifact_id");
CREATE INDEX "idx_schema_field_entity" ON "schema_field" ("schema_entity_id");
CREATE INDEX "idx_api_endpoint_artifact" ON "api_endpoint" ("api_artifact_id");
CREATE INDEX "idx_roadmap_phase_artifact" ON "roadmap_phase" ("roadmap_artifact_id");
CREATE INDEX "idx_task_artifact" ON "task" ("task_artifact_id");
CREATE INDEX "idx_task_roadmap_phase" ON "task" ("roadmap_phase_id");
CREATE INDEX "idx_verification_run_project" ON "verification_run" ("project_id", "triggered_at");
CREATE INDEX "idx_finding_run_severity" ON "finding" ("verification_run_id", "severity");
CREATE INDEX "idx_finding_run_spec_area" ON "finding" ("verification_run_id", "spec_area");
