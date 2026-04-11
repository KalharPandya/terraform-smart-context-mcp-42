// Gate system — three-tier access control for MCP tools
// Tools above the configured tier are never registered (LLM can't see them)

export type GateLevel = "read" | "write" | "destroy";

const TIER_ORDER: Record<GateLevel, number> = {
  read: 0,
  write: 1,
  destroy: 2,
};

// Every tool mapped to its minimum required tier
const TOOL_TIERS: Record<string, GateLevel> = {
  // Read tier — zero infra change
  terraform_init: "read",
  terraform_validate: "read",
  terraform_plan: "read",
  terraform_show: "read",
  terraform_state_list: "read",
  terraform_state_show: "read",
  terraform_output: "read",
  terraform_graph: "read",
  terraform_providers: "read",
  terraform_fmt: "read",
  query_graph: "read",
  get_schema: "read",

  // Write tier — creates/modifies infra
  terraform_apply: "write",
  terraform_import: "write",
  terraform_state_mv: "write",

  // Destroy tier — permanently removes infra/state
  terraform_destroy: "destroy",
  terraform_state_rm: "destroy",
};

export function getGateLevel(): GateLevel {
  const raw = (process.env.TERRAFORM_MCP_GATE ?? "read").toLowerCase().trim();
  if (raw === "read" || raw === "write" || raw === "destroy") return raw;
  console.error(
    `Invalid TERRAFORM_MCP_GATE="${raw}", defaulting to "read". Valid: read, write, destroy`
  );
  return "read";
}

export function isToolAllowed(toolName: string, gate: GateLevel): boolean {
  const toolTier = TOOL_TIERS[toolName];
  if (!toolTier) return false; // unknown tool — block by default
  return TIER_ORDER[toolTier] <= TIER_ORDER[gate];
}

export function getToolTier(toolName: string): GateLevel | undefined {
  return TOOL_TIERS[toolName];
}
