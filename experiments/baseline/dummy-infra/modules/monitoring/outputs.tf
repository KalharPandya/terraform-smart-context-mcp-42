output "sns_topic_arn" {
  value = null_resource.sns_topic.triggers.topic_arn
}

output "dashboard_name" {
  value = null_resource.cw_dashboard.triggers.dashboard_name
}

output "log_group_name" {
  value = null_resource.cw_log_group.triggers.name
}

output "alarm_cpu_arn" {
  value = null_resource.cw_alarm_cpu.triggers.alarm_arn
}

output "alarm_5xx_arn" {
  value = null_resource.cw_alarm_5xx.triggers.alarm_arn
}
