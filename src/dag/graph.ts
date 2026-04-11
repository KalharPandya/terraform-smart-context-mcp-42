// DagGraph singleton — graphology-backed graph with lazy init and state hash detection

import { statSync, existsSync } from "fs";
import { join } from "path";
import { DirectedGraph } from "graphology";
import { topologicalSort, willCreateCycle } from "graphology-dag";
import { bfsFromNode } from "graphology-traversal";
import { bidirectional } from "graphology-shortest-path";

import { buildFromJson } from "./builder.js";
import { buildIndexes } from "./indexes.js";
import { runTerraform } from "../terraform/cli.js";
import type { DagNode, DagEdge, DagIndexes, GraphState, StateFingerprint, ModuleInfo } from "./types.js";

export class DagGraph {
  private state: GraphState = "uninitialized";
  private graph = new DirectedGraph();
  private nodeData = new Map<string, DagNode>();
  private edgeData: DagEdge[] = [];
  private indexes: DagIndexes | null = null;
  private topoOrder: string[] = [];
  private workingDir: string | null = null;
  private lastFingerprint: StateFingerprint | null = null;
  private lastError: string | null = null;

  // ─── Public lifecycle ───────────────────────────────────────────────────────

  /** Ensure the graph is built and up to date. Call before any query. */
  async ensureBuilt(workingDir: string): Promise<void> {
    if (this.state === "building") {
      // Wait briefly — shouldn't happen in single-threaded Node but be safe
      await new Promise((r) => setTimeout(r, 50));
      return;
    }

    // Check if state file changed since last build (out-of-band detection)
    if (this.state === "ready" && this.workingDir === workingDir) {
      if (!this.isStateStale(workingDir)) return; // cache hit
      // State changed externally — rebuild
    }

    this.state = "building";
    this.workingDir = workingDir;

    try {
      const { stdout, exitCode } = runTerraform(["show", "-json", "-no-color"], workingDir);
      if (exitCode !== 0 || !stdout.trim()) {
        throw new Error(
          "terraform show -json failed. Run terraform_init and terraform_apply first."
        );
      }

      const { nodes, edges } = buildFromJson(stdout);
      this.populate(nodes, edges);
      this.lastFingerprint = this.readFingerprint(workingDir);
      this.state = "ready";
      this.lastError = null;
    } catch (err) {
      this.state = "error";
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  /** Invalidate cache — next query will rebuild. Called by apply/destroy tools. */
  invalidate(): void {
    this.state = "uninitialized";
    this.lastFingerprint = null;
  }

  get isReady(): boolean {
    return this.state === "ready";
  }

  get error(): string | null {
    return this.lastError;
  }

  // ─── Node accessors ─────────────────────────────────────────────────────────

  getNode(id: string): DagNode | undefined {
    return this.nodeData.get(id);
  }

  /** Resolve by full ID first, then by shortName (returns first match). */
  resolveNode(idOrName: string): DagNode | undefined {
    if (this.nodeData.has(idOrName)) return this.nodeData.get(idOrName);
    const byName = this.indexes?.nodeByShortName.get(idOrName);
    if (byName?.length) return this.nodeData.get(byName[0]);
    return undefined;
  }

  getAllNodes(): DagNode[] {
    return [...this.nodeData.values()];
  }

  getNodesByModule(module: string): DagNode[] {
    const ids = this.indexes?.nodesByModule.get(module) ?? [];
    return ids.map((id) => this.nodeData.get(id)!).filter(Boolean);
  }

  getNodesByType(type: string): DagNode[] {
    const ids = this.indexes?.nodesByType.get(type) ?? [];
    return ids.map((id) => this.nodeData.get(id)!).filter(Boolean);
  }

  getModules(): Map<string, ModuleInfo> {
    return this.indexes?.modules ?? new Map();
  }

  // ─── Graph traversal (via graphology) ──────────────────────────────────────

  /** Resources this node depends ON (outgoing edges = dependencies). */
  getDependencies(nodeId: string, depth: number = 1): Array<{ node: DagNode; depth: number }> {
    return this.bfsCollect(nodeId, depth, "out");
  }

  /** Resources that depend ON this node (incoming edges = dependents). */
  getDependents(nodeId: string, depth: number = 1): Array<{ node: DagNode; depth: number }> {
    return this.bfsCollect(nodeId, depth, "in");
  }

  /** Shortest path from → to using graphology-shortest-path. */
  getPath(fromId: string, toId: string): string[] | null {
    if (!this.graph.hasNode(fromId) || !this.graph.hasNode(toId)) return null;
    try {
      return bidirectional(this.graph, fromId, toId);
    } catch {
      return null;
    }
  }

  /** Topological order (all nodes or filtered by module). */
  getTopologicalOrder(module?: string): DagNode[] {
    const ids = module
      ? this.topoOrder.filter(
          (id) => this.nodeData.get(id)?.module === module
        )
      : this.topoOrder;
    return ids.map((id) => this.nodeData.get(id)!).filter(Boolean);
  }

  /** Out-degree (how many things does this node depend on). */
  outDegree(nodeId: string): number {
    return this.graph.hasNode(nodeId) ? this.graph.outDegree(nodeId) : 0;
  }

  /** In-degree (how many things depend on this node). */
  inDegree(nodeId: string): number {
    return this.graph.hasNode(nodeId) ? this.graph.inDegree(nodeId) : 0;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private populate(nodes: DagNode[], edges: DagEdge[]): void {
    this.graph = new DirectedGraph();
    this.nodeData.clear();
    this.edgeData = edges;

    // Add nodes
    for (const node of nodes) {
      this.graph.addNode(node.id);
      this.nodeData.set(node.id, node);
    }

    // Add edges — skip any that would create a cycle (safety guard)
    for (const edge of edges) {
      if (!this.graph.hasNode(edge.from) || !this.graph.hasNode(edge.to)) continue;
      if (this.graph.hasEdge(edge.from, edge.to)) continue;
      try {
        if (!willCreateCycle(this.graph, edge.from, edge.to)) {
          this.graph.addEdge(edge.from, edge.to);
        }
      } catch {
        // graphology-dag may throw on disconnected graphs — skip
      }
    }

    // Build domain indexes
    this.indexes = buildIndexes(nodes);

    // Compute topological order
    try {
      this.topoOrder = topologicalSort(this.graph);
    } catch {
      // If cycle check missed something, fall back to insertion order
      this.topoOrder = nodes.map((n) => n.id);
    }
  }

  private bfsCollect(
    startId: string,
    maxDepth: number,
    direction: "in" | "out"
  ): Array<{ node: DagNode; depth: number }> {
    if (!this.graph.hasNode(startId)) return [];

    const results: Array<{ node: DagNode; depth: number }> = [];
    const visited = new Set<string>([startId]);

    bfsFromNode(
      this.graph,
      startId,
      (nodeId, attr, depth) => {
        if (depth === 0) return; // skip start node
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = this.nodeData.get(nodeId);
        if (node) results.push({ node, depth });
        return depth >= maxDepth; // prune: don't expand beyond max depth
      },
      { mode: direction }
    );

    return results;
  }

  private isStateStale(workingDir: string): boolean {
    const current = this.readFingerprint(workingDir);
    if (!current || !this.lastFingerprint) return true;
    return (
      current.mtimeMs !== this.lastFingerprint.mtimeMs ||
      current.size !== this.lastFingerprint.size
    );
  }

  private readFingerprint(workingDir: string): StateFingerprint | null {
    const tfstatePath = join(workingDir, "terraform.tfstate");
    if (!existsSync(tfstatePath)) return null;
    try {
      const s = statSync(tfstatePath);
      return { mtimeMs: s.mtimeMs, size: s.size };
    } catch {
      return null;
    }
  }
}

// Singleton — one graph per server process
export const dagGraph = new DagGraph();
