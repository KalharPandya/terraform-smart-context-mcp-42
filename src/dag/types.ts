// DAG types — nodes, edges, indexes, and terraform show -json schema

// ─── Terraform show -json shape ───────────────────────────────────────────────

export interface TerraformShowJson {
  format_version: string;
  terraform_version: string;
  values?: {
    outputs: Record<string, { value: unknown; type: unknown; sensitive?: boolean }>;
    root_module: TerraformModule;
  };
}

export interface TerraformModule {
  address?: string;
  resources?: TerraformResource[];
  child_modules?: TerraformModule[];
}

export interface TerraformResource {
  address: string;        // "module.compute.null_resource.app_instance_1"
  mode: "managed" | "data";
  type: string;           // "null_resource"
  name: string;           // "app_instance_1"
  provider_name: string;
  schema_version: number;
  values: Record<string, unknown>;          // full resource state — nothing filtered
  sensitive_values: Record<string, unknown>;
  depends_on?: string[];  // full addresses of dependencies
}

// ─── DAG node ─────────────────────────────────────────────────────────────────

export interface DagNode {
  id: string;             // "module.networking.null_resource.vpc"
  shortName: string;      // "vpc"
  resourceType: string;   // "null_resource"
  module: string;         // "networking" ("" for root module resources)
  attributes: Record<string, unknown>; // FULL resource.values — nothing filtered
  tags: Record<string, string>;        // parsed from attributes.tags if available
  summary: {
    name: string;         // attributes.name ?? shortName
    arn: string;          // attributes.arn ?? ""
  };
}

// ─── DAG edge ─────────────────────────────────────────────────────────────────

export interface DagEdge {
  from: string;           // dependent (has the dependency)
  to: string;             // dependency (being depended upon)
  type: "explicit";       // from depends_on array
  source: string;         // "depends_on"
}

// ─── Domain indexes (built on top of graphology) ──────────────────────────────

export interface ModuleInfo {
  name: string;
  resourceCount: number;
  resourceIds: string[];
}

export interface DagIndexes {
  nodesByModule: Map<string, string[]>;    // module name → resource IDs
  nodesByType: Map<string, string[]>;      // resource type → resource IDs
  nodeByShortName: Map<string, string[]>;  // shortName → resource IDs (can collide across modules)
  modules: Map<string, ModuleInfo>;        // module name → module info
}

// ─── Graph state ──────────────────────────────────────────────────────────────

export type GraphState = "uninitialized" | "building" | "ready" | "error";

export interface StateFingerprint {
  mtimeMs: number;
  size: number;
}
