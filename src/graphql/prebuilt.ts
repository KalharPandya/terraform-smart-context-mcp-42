// Prebuilt query generator — produces ready-to-run GraphQL using REAL resource IDs

import { dagGraph } from "../dag/graph.js";

export interface PrebuiltQuery {
  title: string;
  description: string;
  query: string;
}

export interface PrebuiltResult {
  queries: PrebuiltQuery[];
  note: string;
}

// ─── Scoped generators ────────────────────────────────────────────────────────

export function generateForInfra(): PrebuiltResult {
  const queries: PrebuiltQuery[] = [];

  queries.push(summaryQuery());

  const mods = [...dagGraph.getModules().entries()]
    .filter(([name]) => name !== "")
    .sort((a, b) => b[1].resourceCount - a[1].resourceCount)
    .slice(0, 3);

  for (const [name] of mods) {
    queries.push(moduleQuery(name));
  }

  const highFanOut = findHighFanOut();
  if (highFanOut) queries.push(dependentsQuery(highFanOut.id, highFanOut.shortName));

  const cascade = findCascadeNode();
  if (cascade) queries.push(impactQuery(cascade.id, cascade.shortName));

  const crossPath = findCrossModulePath();
  if (crossPath) queries.push(pathQuery(crossPath.from, crossPath.to));

  if (mods.length > 0) {
    queries.push(deploymentOrderQuery(mods[0][0]));
  }

  return {
    queries,
    note: `Generated from live infrastructure: ${dagGraph.getAllNodes().length} resources across ${dagGraph.getModules().size} modules.`,
  };
}

export function generateForModule(moduleName: string): PrebuiltResult {
  const queries: PrebuiltQuery[] = [];
  const nodes = dagGraph.getNodesByModule(moduleName);

  if (!nodes.length) {
    return { queries: [], note: `Module "${moduleName}" not found or has no resources.` };
  }

  queries.push({
    title: "Module resources",
    description: `All resources in the ${moduleName} module`,
    query: `query ${safeName(moduleName)}Resources {\n  resources(module: "${moduleName}") {\n    nodes { id shortName resourceType }\n    totalCount\n  }\n}`,
  });

  queries.push(deploymentOrderQuery(moduleName));

  const highFanOut = findHighFanOutIn(moduleName);
  if (highFanOut) queries.push(dependentsQuery(highFanOut.id, highFanOut.shortName));

  const crossEdge = findCrossModuleEdgeFrom(moduleName);
  if (crossEdge) queries.push(pathQuery(crossEdge.from, crossEdge.to));

  return {
    queries,
    note: `Scoped to module "${moduleName}" (${nodes.length} resources).`,
  };
}

export function generateForResource(resourceId: string): PrebuiltResult {
  const queries: PrebuiltQuery[] = [];
  const node = dagGraph.resolveNode(resourceId);

  if (!node) {
    return { queries: [], note: `Resource "${resourceId}" not found.` };
  }

  const id = node.id;
  const name = node.shortName;

  queries.push({
    title: "Resource details",
    description: `Full state for ${name}`,
    query: `query ${safeName(name)}Detail {\n  resource(id: "${id}") {\n    id shortName resourceType module\n    attributes\n    tags\n  }\n}`,
  });

  queries.push({
    title: "Direct dependencies",
    description: `What ${name} depends on`,
    query: `query ${safeName(name)}Deps {\n  resource(id: "${id}") {\n    dependencies(depth: 1) {\n      resource { id shortName module }\n      depth\n    }\n  }\n}`,
  });

  queries.push({
    title: "Direct dependents",
    description: `What depends on ${name}`,
    query: `query ${safeName(name)}Dependents {\n  resource(id: "${id}") {\n    dependents(depth: 1) {\n      resource { id shortName module }\n      depth\n    }\n  }\n}`,
  });

  queries.push(impactQuery(id, name));

  const neighbor = findNeighborInOtherModule(node);
  if (neighbor) queries.push(pathQuery(id, neighbor.id));

  return {
    queries,
    note: `Scoped to resource "${id}" (module: ${node.module || "root"}, type: ${node.resourceType}).`,
  };
}

// ─── Individual query builders ────────────────────────────────────────────────

function summaryQuery(): PrebuiltQuery {
  return {
    title: "Infrastructure summary",
    description: "Resource and module counts with type breakdown",
    query: `query InfraSummary {\n  summary {\n    totalResources\n    totalModules\n    moduleNames\n    typeBreakdown { resourceType count }\n  }\n}`,
  };
}

function moduleQuery(name: string): PrebuiltQuery {
  const nodes = dagGraph.getNodesByModule(name);
  return {
    title: `Module: ${name}`,
    description: `${nodes.length} resources in the ${name} module`,
    query: `query ${safeName(name)}Module {\n  module(name: "${name}") {\n    name\n    resourceCount\n    resources { id shortName resourceType }\n  }\n}`,
  };
}

function dependentsQuery(id: string, name: string): PrebuiltQuery {
  const count = dagGraph.inDegree(id);
  return {
    title: `Dependents of ${name}`,
    description: `${count} resources depend on ${name}`,
    query: `query ${safeName(name)}Dependents {\n  resource(id: "${id}") {\n    dependents(depth: 2) {\n      resource { id shortName module }\n      depth\n    }\n  }\n}`,
  };
}

function impactQuery(id: string, name: string): PrebuiltQuery {
  return {
    title: `Impact: destroy ${name}`,
    description: `What breaks if ${name} is removed`,
    query: `query ${safeName(name)}Impact {\n  impact(resourceId: "${id}", depth: 3) {\n    resource { id shortName }\n    affectedCount\n    affected {\n      resource { id shortName module }\n      depth\n    }\n  }\n}`,
  };
}

function pathQuery(fromId: string, toId: string): PrebuiltQuery {
  const fromNode = dagGraph.getNode(fromId);
  const toNode = dagGraph.getNode(toId);
  const fromName = fromNode?.shortName ?? fromId;
  const toName = toNode?.shortName ?? toId;
  return {
    title: `Path: ${fromName} → ${toName}`,
    description: `Dependency chain between ${fromName} and ${toName}`,
    query: `query PathFrom${safeName(fromName)}To${safeName(toName)} {\n  path(fromId: "${fromId}", toId: "${toId}") {\n    found\n    length\n    path { id shortName module }\n  }\n}`,
  };
}

function deploymentOrderQuery(module: string): PrebuiltQuery {
  return {
    title: `Deploy order: ${module}`,
    description: `Topological build order for ${module}`,
    query: `query ${safeName(module)}DeployOrder {\n  deploymentOrder(module: "${module}") {\n    id shortName resourceType\n  }\n}`,
  };
}

// ─── Graph analysis helpers ───────────────────────────────────────────────────

function findHighFanOut() {
  return dagGraph.getAllNodes()
    .map((n) => ({ ...n, fanIn: dagGraph.inDegree(n.id) }))
    .sort((a, b) => b.fanIn - a.fanIn)
    .find((n) => n.fanIn > 0);
}

function findHighFanOutIn(module: string) {
  return dagGraph.getNodesByModule(module)
    .map((n) => ({ ...n, fanIn: dagGraph.inDegree(n.id) }))
    .sort((a, b) => b.fanIn - a.fanIn)
    .find((n) => n.fanIn > 0);
}

function findCascadeNode() {
  // Node whose dependents also have dependents (2-hop cascade)
  return dagGraph.getAllNodes().find((n) => {
    const direct = dagGraph.getDependents(n.id, 1);
    return direct.some((d) => dagGraph.inDegree(d.node.id) > 0);
  });
}

function findCrossModulePath(): { from: string; to: string } | null {
  const mods = [...dagGraph.getModules().keys()].filter((k) => k !== "");
  if (mods.length < 2) return null;

  // Find any edge crossing module boundaries
  for (const node of dagGraph.getAllNodes()) {
    const deps = dagGraph.getDependencies(node.id, 1);
    const crossDep = deps.find((d) => d.node.module !== node.module);
    if (crossDep) return { from: node.id, to: crossDep.node.id };
  }
  return null;
}

function findCrossModuleEdgeFrom(module: string): { from: string; to: string } | null {
  for (const node of dagGraph.getNodesByModule(module)) {
    const deps = dagGraph.getDependencies(node.id, 1);
    const crossDep = deps.find((d) => d.node.module !== module);
    if (crossDep) return { from: node.id, to: crossDep.node.id };
  }
  return null;
}

function findNeighborInOtherModule(node: import("../dag/types.js").DagNode) {
  const deps = dagGraph.getDependencies(node.id, 1);
  const cross = deps.find((d) => d.node.module !== node.module);
  if (cross) return cross.node;
  const dependents = dagGraph.getDependents(node.id, 1);
  const crossDep = dependents.find((d) => d.node.module !== node.module);
  return crossDep?.node ?? null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Convert a resource/module name to a safe GraphQL operation name (PascalCase, no dots). */
function safeName(name: string): string {
  return name
    .split(/[._\-\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^\d+/, "") || "Resource";
}
