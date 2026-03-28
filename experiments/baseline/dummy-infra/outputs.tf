# --- Networking Outputs ---
output "vpc_id" {
  value = module.networking.vpc_id
}

output "vpc_cidr" {
  value = module.networking.vpc_cidr
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.networking.private_subnet_ids
}

output "db_subnet_ids" {
  value = module.networking.db_subnet_ids
}

# --- Security Outputs ---
output "sg_alb_id" {
  value = module.security.sg_alb_id
}

output "sg_web_id" {
  value = module.security.sg_web_id
}

output "sg_app_id" {
  value = module.security.sg_app_id
}

output "sg_db_id" {
  value = module.security.sg_db_id
}

# --- Compute Outputs ---
output "web_instance_ids" {
  value = module.compute.web_instance_ids
}

output "app_instance_ids" {
  value = module.compute.app_instance_ids
}

output "asg_web_name" {
  value = module.compute.asg_web_name
}

output "asg_app_name" {
  value = module.compute.asg_app_name
}

output "bastion_public_ip" {
  value = module.compute.bastion_public_ip
}

# --- Database Outputs ---
output "rds_endpoint" {
  value = module.database.rds_endpoint
}

output "rds_replica_endpoint" {
  value = module.database.rds_replica_endpoint
}

output "redis_endpoint" {
  value = module.database.redis_endpoint
}

# --- Load Balancer Outputs ---
output "alb_dns_name" {
  value = module.loadbalancer.alb_dns_name
}

output "alb_arn" {
  value = module.loadbalancer.alb_arn
}

# --- Monitoring Outputs ---
output "sns_topic_arn" {
  value = module.monitoring.sns_topic_arn
}

output "dashboard_name" {
  value = module.monitoring.dashboard_name
}

output "log_group_name" {
  value = module.monitoring.log_group_name
}
