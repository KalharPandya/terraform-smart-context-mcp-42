// GraphQL resolvers — all reads go through DagGraph accessors

import { dagGraph } from "../dag/graph.js";
import type { DagNode } from "../dag/types.js";

// Defaults
const DEFAULT_LIMIT = 50;
const DEFAULT_DEPTH = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toGqlResource(node: DagNode) {
  return {
    id: node.id,
    shortName: node.shortName,
    module: node.module,
    resourceType: node.resourceType,
    attributes: node.attributes,
    tags: node.tags,
    dependencies: ({ depth }: { depth?: number }) =>
      dagGraph
        .getDependencies(node.id, depth ?? DEFAULT_DEPTH)
        .map(({ node: n, depth: d }) => ({ resource: toGqlResource(n), depth: d })),
    dependents: ({ depth }: { depth?: number }) =>
      dagGraph
        .getDependents(node.id, depth ?? DEFAULT_DEPTH)
        .map(({ node: n, depth: d }) => ({ resource: toGqlResource(n), depth: d })),
  };
}

// ─── Root resolvers ──────────────────────────────────────────────────────────

export const rootValue = {
  resource({ id }: { id: string }) {
    const node = dagGraph.resolveNode(id);
    return node ? toGqlResource(node) : null;
  },

  resources({
    module,
    type,
    limit,
  }: {
    module?: string;
    type?: string;
    limit?: number;
  }) {
    let nodes = dagGraph.getAllNodes();

    if (module !== undefined) nodes = nodes.filter((n) => n.module === module);
    if (type !== undefined) nodes = nodes.filter((n) => n.resourceType === type);

    const cap = limit ?? DEFAULT_LIMIT;
    const sliced = nodes.slice(0, cap);

    return {
      nodes: sliced.map(toGqlResource),
      totalCount: nodes.length,
    };
  },

  module({ name }: { name: string }) {
    const moduleNodes = dagGraph.getNodesByModule(name);
    if (!moduleNodes.length) return null;
    return {
      name: name || "(root)",
      resourceCount: moduleNodes.length,
      resources: moduleNodes.map(toGqlResource),
    };
  },

  modules() {
    const mods = dagGraph.getModules();
    return [...mods.values()].map((m) => ({
      name: m.name,
      resourceCount: m.resourceCount,
      resources: dagGraph.getNodesByModule(m.name === "(root)" ? "" : m.name).map(toGqlResource),
    }));
  },

  path({
    fromId,
    toId,
    maxDepth: _maxDepth,
  }: {
    fromId: string;
    toId: string;
    maxDepth?: number;
  }) {
    const pathIds = dagGraph.getPath(fromId, toId);
    if (!pathIds) return { found: false, path: [], length: 0 };
    const pathNodes = pathIds
      .map((id) => dagGraph.getNode(id))
      .filter((n): n is DagNode => Boolean(n))
      .map(toGqlResource);
    return { found: pathNodes.length > 0, path: pathNodes, length: pathNodes.length };
  },

  impact({
    resourceId,
    depth,
  }: {
    resourceId: string;
    depth?: number;
  }) {
    const node = dagGraph.resolveNode(resourceId);
    const affected = dagGraph.getDependents(resourceId, depth ?? 2);
    return {
      resource: node ? toGqlResource(node) : null,
      affectedCount: affected.length,
      affected: affected.map(({ node: n, depth: d }) => ({ resource: toGqlResource(n), depth: d })),
    };
  },

  deploymentOrder({ module }: { module?: string }) {
    return dagGraph.getTopologicalOrder(module).map(toGqlResource);
  },

  summary() {
    const nodes = dagGraph.getAllNodes();
    const mods = dagGraph.getModules();

    // Count by type
    const typeCounts = new Map<string, number>();
    for (const node of nodes) {
      typeCounts.set(node.resourceType, (typeCounts.get(node.resourceType) ?? 0) + 1);
    }
    const typeBreakdown = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([resourceType, count]) => ({ resourceType, count }));

    return {
      totalResources: nodes.length,
      totalModules: mods.size,
      moduleNames: [...mods.keys()].map((k) => k || "(root)"),
      typeBreakdown,
    };
  },
};
