// Builder — parses terraform show -json output into DagNode[] + DagEdge[]

import type {
  TerraformShowJson,
  TerraformModule,
  TerraformResource,
  DagNode,
  DagEdge,
} from "./types.js";

export interface BuildResult {
  nodes: DagNode[];
  edges: DagEdge[];
}

export function buildFromJson(jsonStr: string): BuildResult {
  const raw = JSON.parse(jsonStr) as TerraformShowJson;

  if (!raw.values?.root_module) {
    return { nodes: [], edges: [] };
  }

  const nodes: DagNode[] = [];
  const edges: DagEdge[] = [];
  const nodeIds = new Set<string>();

  walkModule(raw.values.root_module, nodes, edges, nodeIds);

  // Deduplicate edges (same from→to pair)
  const edgeKeys = new Set<string>();
  const dedupedEdges = edges.filter((e) => {
    const key = `${e.from}→${e.to}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  // Filter edges to only reference known nodes
  const validEdges = dedupedEdges.filter(
    (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
  );

  return { nodes, edges: validEdges };
}

function walkModule(
  mod: TerraformModule,
  nodes: DagNode[],
  edges: DagEdge[],
  nodeIds: Set<string>
): void {
  for (const resource of mod.resources ?? []) {
    if (resource.mode !== "managed") continue; // skip data sources
    const node = makeNode(resource);
    nodes.push(node);
    nodeIds.add(node.id);

    for (const dep of resource.depends_on ?? []) {
      edges.push({
        from: resource.address,
        to: dep,
        type: "explicit",
        source: "depends_on",
      });
    }
  }

  for (const child of mod.child_modules ?? []) {
    walkModule(child, nodes, edges, nodeIds);
  }
}

function makeNode(resource: TerraformResource): DagNode {
  const module = extractModule(resource.address);
  const attributes = resource.values; // full state, nothing filtered

  // Parse tags — may be an object, a JSON string, or absent
  const tags = parseTags(attributes.tags);

  // Best-effort summary fields
  const name = String(
    (attributes as Record<string, unknown>).name ??
      (attributes as Record<string, unknown>).display_name ??
      resource.name
  );
  const arn = String((attributes as Record<string, unknown>).arn ?? "");

  return {
    id: resource.address,
    shortName: resource.name,
    resourceType: resource.type,
    module,
    attributes,
    tags,
    summary: { name, arn },
  };
}

function extractModule(address: string): string {
  // "module.networking.null_resource.vpc" → "networking"
  // "module.compute.module.sub.null_resource.x" → "compute.sub"
  // "null_resource.vpc" → "" (root module)
  const parts = address.split(".");
  const moduleSegments: string[] = [];
  let i = 0;
  while (i < parts.length - 2) {
    if (parts[i] === "module") {
      moduleSegments.push(parts[i + 1]);
      i += 2;
    } else {
      break;
    }
  }
  return moduleSegments.join(".");
}

function parseTags(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      result[k] = String(v);
    }
    return result;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parseTags(parsed);
    } catch {
      return {};
    }
  }
  return {};
}
