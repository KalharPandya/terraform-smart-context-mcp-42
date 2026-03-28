output "web_instance_ids" {
  value = [
    null_resource.web_instance_1.triggers.instance_id,
    null_resource.web_instance_2.triggers.instance_id,
  ]
}

output "app_instance_ids" {
  value = [
    null_resource.app_instance_1.triggers.instance_id,
    null_resource.app_instance_2.triggers.instance_id,
  ]
}

output "asg_web_name" {
  value = null_resource.asg_web.triggers.asg_name
}

output "asg_app_name" {
  value = null_resource.asg_app.triggers.asg_name
}

output "asg_web_arn" {
  value = null_resource.asg_web.triggers.asg_arn
}

output "asg_app_arn" {
  value = null_resource.asg_app.triggers.asg_arn
}

output "bastion_public_ip" {
  value = null_resource.bastion.triggers.public_ip
}

output "key_pair_name" {
  value = null_resource.key_pair.triggers.key_name
}
