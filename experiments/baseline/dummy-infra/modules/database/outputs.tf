output "rds_endpoint" {
  value = null_resource.rds_primary.triggers.endpoint
}

output "rds_primary_id" {
  value = null_resource.rds_primary.triggers.db_instance_id
}

output "rds_replica_endpoint" {
  value = null_resource.rds_replica.triggers.endpoint
}

output "redis_endpoint" {
  value = null_resource.elasticache_cluster.triggers.endpoint
}

output "db_secret_arn" {
  value = null_resource.secrets_manager_secret.triggers.secret_arn
}

output "rds_arn" {
  value = null_resource.rds_primary.triggers.arn
}
