output "vpc_id" {
  value = null_resource.vpc.triggers.vpc_id
}

output "vpc_cidr" {
  value = null_resource.vpc.triggers.cidr_block
}

output "public_subnet_ids" {
  value = [
    null_resource.public_subnet_1.triggers.subnet_id,
    null_resource.public_subnet_2.triggers.subnet_id,
    null_resource.public_subnet_3.triggers.subnet_id,
  ]
}

output "private_subnet_ids" {
  value = [
    null_resource.private_subnet_1.triggers.subnet_id,
    null_resource.private_subnet_2.triggers.subnet_id,
    null_resource.private_subnet_3.triggers.subnet_id,
  ]
}

output "db_subnet_ids" {
  value = [
    null_resource.db_subnet_1.triggers.subnet_id,
    null_resource.db_subnet_2.triggers.subnet_id,
  ]
}

output "nat_gateway_id" {
  value = null_resource.nat_gateway.triggers.nat_gateway_id
}

output "internet_gateway_id" {
  value = null_resource.internet_gateway.triggers.igw_id
}
