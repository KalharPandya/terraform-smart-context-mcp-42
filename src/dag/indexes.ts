// Domain-specific Map indexes built on top of the graphology graph

import type { DagNode, DagIndexes, ModuleInfo } from "./types.js";

export function buildIndexes(nodes: DagNode[]): DagIndexes {
  const nodesByModule = new Map<string, string[]>();
  const nodesByType = new Map<string, string[]>();
  const nodeByShortName = new Map<string, string[]>();
  const modules = new Map<string, ModuleInfo>();

  for (const node of nodes) {
    // nodesByModule
    const modList = nodesByModule.get(node.module) ?? [];
    modList.push(node.id);
    nodesByModule.set(node.module, modList);

    // nodesByType
    const typeList = nodesByType.get(node.resourceType) ?? [];
    typeList.push(node.id);
    nodesByType.set(node.resourceType, typeList);

    // nodeByShortName
    const nameList = nodeByShortName.get(node.shortName) ?? [];
    nameList.push(node.id);
    nodeByShortName.set(node.shortName, nameList);

    // modules metadata
    const existing = modules.get(node.module);
    if (existing) {
      existing.resourceCount++;
      existing.resourceIds.push(node.id);
    } else {
      modules.set(node.module, {
        name: node.module || "(root)",
        resourceCount: 1,
        resourceIds: [node.id],
      });
    }
  }

  return { nodesByModule, nodesByType, nodeByShortName, modules };
}

// Adding a new index: extend DagIndexes in types.ts, add one entry here,
// add an accessor on DagGraph. Cost: O(n) per index, <1ms at 500 resources.
