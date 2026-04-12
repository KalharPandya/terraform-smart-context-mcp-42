// GraphQL SDL + built schema

import { buildSchema } from "graphql";

export const SDL = /* GraphQL */ `
  scalar JSON

  type Query {
    resource(id: String!): Resource
    resources(module: String, type: String, limit: Int): ResourceConnection!
    module(name: String!): Module
    modules: [Module!]!
    path(fromId: String!, toId: String!, maxDepth: Int): PathResult
    impact(resourceId: String!, depth: Int): ImpactResult!
    deploymentOrder(module: String): [Resource!]!
    summary: InfraSummary!
  }

  type Resource {
    id: String!
    shortName: String!
    module: String!
    resourceType: String!
    summary: ResourceSummary!
    attributes: JSON
    tags: JSON
    dependencies(depth: Int): [DependencyEdge!]!
    dependents(depth: Int): [DependencyEdge!]!
  }

  type ResourceSummary {
    name: String!
    arn: String!
  }

  type DependencyEdge {
    resource: Resource!
    depth: Int!
  }

  type ResourceConnection {
    nodes: [Resource!]!
    totalCount: Int!
  }

  type Module {
    name: String!
    resourceCount: Int!
    resources: [Resource!]!
  }

  type PathResult {
    found: Boolean!
    path: [Resource!]!
    length: Int!
  }

  type ImpactResult {
    resource: Resource
    affectedCount: Int!
    affected: [DependencyEdge!]!
  }

  type TypeBreakdown {
    resourceType: String!
    count: Int!
  }

  type InfraSummary {
    totalResources: Int!
    totalModules: Int!
    moduleNames: [String!]!
    typeBreakdown: [TypeBreakdown!]!
  }
`;

export const schema = buildSchema(SDL);
