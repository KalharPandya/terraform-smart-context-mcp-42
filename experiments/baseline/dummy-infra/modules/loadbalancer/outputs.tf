output "alb_dns_name" {
  value = null_resource.alb.triggers.dns_name
}

output "alb_arn" {
  value = null_resource.alb.triggers.alb_arn
}

output "alb_zone_id" {
  value = null_resource.alb.triggers.zone_id
}

output "target_group_web_arn" {
  value = null_resource.target_group_web.triggers.tg_arn
}

output "target_group_app_arn" {
  value = null_resource.target_group_app.triggers.tg_arn
}

output "https_listener_arn" {
  value = null_resource.listener_https.triggers.listener_arn
}
