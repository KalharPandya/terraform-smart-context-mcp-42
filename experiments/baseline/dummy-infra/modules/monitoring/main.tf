# --- SNS Topic ---
resource "null_resource" "sns_topic" {
  triggers = {
    topic_arn             = "arn:aws:sns:${var.region}:123456789012:${var.project_name}-alerts"
    name                  = "${var.project_name}-alerts"
    display_name          = "${var.project_name} Infrastructure Alerts"
    kms_master_key_id     = "arn:aws:kms:${var.region}:123456789012:key/mrk-sns-key-001"
    fifo_topic            = "false"
    content_based_dedup   = "false"
    delivery_policy       = jsonencode({ http = { defaultHealthyRetryPolicy = { numRetries = 3, minDelayTarget = 20, maxDelayTarget = 20 } } })
    policy                = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "cloudwatch.amazonaws.com" }, Action = "SNS:Publish", Resource = "*" }] })
    owner                 = "123456789012"
    effective_delivery_policy = jsonencode({ http = { defaultHealthyRetryPolicy = { numRetries = 3, minDelayTarget = 20, maxDelayTarget = 20 } } })
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-alerts", Environment = var.environment, ManagedBy = "terraform", Team = "platform-oncall" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

# --- SNS Subscriptions ---
resource "null_resource" "sns_subscription_email" {
  triggers = {
    subscription_arn      = "arn:aws:sns:${var.region}:123456789012:${var.project_name}-alerts:email-sub-001"
    topic_arn             = null_resource.sns_topic.triggers.topic_arn
    protocol              = "email"
    endpoint              = "oncall@project42.example.com"
    confirmation_status   = "confirmed"
    delivery_policy       = ""
    filter_policy         = ""
    filter_policy_scope   = "MessageAttributes"
    owner_id              = "123456789012"
    pending_confirmation  = "false"
    raw_message_delivery  = "false"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-email-sub", ManagedBy = "terraform", Recipient = "oncall-team" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

resource "null_resource" "sns_subscription_slack" {
  triggers = {
    subscription_arn      = "arn:aws:sns:${var.region}:123456789012:${var.project_name}-alerts:slack-sub-001"
    topic_arn             = null_resource.sns_topic.triggers.topic_arn
    protocol              = "https"
    endpoint              = "https://example.com/webhook/dummy-slack-endpoint-not-a-real-secret"
    confirmation_status   = "confirmed"
    delivery_policy       = ""
    filter_policy         = jsonencode({ severity = ["critical", "high"] })
    filter_policy_scope   = "MessageAttributes"
    owner_id              = "123456789012"
    pending_confirmation  = "false"
    raw_message_delivery  = "false"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-slack-sub", ManagedBy = "terraform", Channel = "#infra-alerts" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

# --- CloudWatch Alarms ---
resource "null_resource" "cw_alarm_cpu" {
  triggers = {
    alarm_arn             = "arn:aws:cloudwatch:${var.region}:123456789012:alarm:${var.project_name}-web-cpu-critical"
    alarm_name            = "${var.project_name}-web-cpu-critical"
    alarm_description     = "Critical CPU alarm for web tier ASG - pages oncall when CPU > 80% for 15 min"
    metric_name           = "CPUUtilization"
    namespace             = "AWS/EC2"
    statistic             = "Average"
    period                = "300"
    threshold             = "80"
    comparison_operator   = "GreaterThanThreshold"
    evaluation_periods    = "3"
    datapoints_to_alarm   = "3"
    treat_missing_data    = "missing"
    dimensions_asg        = var.asg_web_name
    alarm_actions         = null_resource.sns_topic.triggers.topic_arn
    ok_actions            = null_resource.sns_topic.triggers.topic_arn
    insufficient_data_actions = ""
    actions_enabled       = "true"
    unit                  = "Percent"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-web-cpu-critical", Environment = var.environment, Severity = "critical", ManagedBy = "terraform", Runbook = "https://wiki.project42.example.com/runbooks/high-cpu" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

resource "null_resource" "cw_alarm_memory" {
  triggers = {
    alarm_arn             = "arn:aws:cloudwatch:${var.region}:123456789012:alarm:${var.project_name}-app-memory-critical"
    alarm_name            = "${var.project_name}-app-memory-critical"
    alarm_description     = "Critical memory alarm for app tier ASG - pages oncall when memory > 85% for 15 min"
    metric_name           = "MemoryUtilization"
    namespace             = "CWAgent"
    statistic             = "Average"
    period                = "300"
    threshold             = "85"
    comparison_operator   = "GreaterThanThreshold"
    evaluation_periods    = "3"
    datapoints_to_alarm   = "3"
    treat_missing_data    = "missing"
    dimensions_asg        = var.asg_app_name
    alarm_actions         = null_resource.sns_topic.triggers.topic_arn
    ok_actions            = null_resource.sns_topic.triggers.topic_arn
    insufficient_data_actions = ""
    actions_enabled       = "true"
    unit                  = "Percent"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-app-memory-critical", Environment = var.environment, Severity = "critical", ManagedBy = "terraform", Runbook = "https://wiki.project42.example.com/runbooks/high-memory" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

resource "null_resource" "cw_alarm_5xx" {
  triggers = {
    alarm_arn             = "arn:aws:cloudwatch:${var.region}:123456789012:alarm:${var.project_name}-alb-5xx-critical"
    alarm_name            = "${var.project_name}-alb-5xx-critical"
    alarm_description     = "Critical 5XX error rate alarm for ALB - pages oncall when > 100 5XX errors in 1 min"
    metric_name           = "HTTPCode_Target_5XX_Count"
    namespace             = "AWS/ApplicationELB"
    statistic             = "Sum"
    period                = "60"
    threshold             = "100"
    comparison_operator   = "GreaterThanThreshold"
    evaluation_periods    = "2"
    datapoints_to_alarm   = "2"
    treat_missing_data    = "notBreaching"
    dimensions_alb        = var.alb_arn
    alarm_actions         = null_resource.sns_topic.triggers.topic_arn
    ok_actions            = null_resource.sns_topic.triggers.topic_arn
    insufficient_data_actions = ""
    actions_enabled       = "true"
    unit                  = "Count"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-alb-5xx-critical", Environment = var.environment, Severity = "critical", ManagedBy = "terraform", Runbook = "https://wiki.project42.example.com/runbooks/5xx-errors" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

# --- CloudWatch Log Group ---
resource "null_resource" "cw_log_group" {
  triggers = {
    log_group_arn         = "arn:aws:logs:${var.region}:123456789012:log-group:/${var.project_name}/application"
    log_group_arn_wildcard = "arn:aws:logs:${var.region}:123456789012:log-group:/${var.project_name}/application:*"
    name                  = "/${var.project_name}/application"
    retention_in_days     = "30"
    kms_key_id            = "arn:aws:kms:${var.region}:123456789012:key/mrk-logs-key-001"
    metric_filter_count   = "1"
    stored_bytes          = "0"
    creation_time         = "1705312200000"
    log_group_class       = "STANDARD"
    data_protection_status = "ACTIVATED"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-app-logs", Environment = var.environment, ManagedBy = "terraform", RetentionDays = "30" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

# --- CloudWatch Metric Filter ---
resource "null_resource" "cw_metric_filter" {
  triggers = {
    name                  = "${var.project_name}-error-filter"
    log_group_name        = null_resource.cw_log_group.triggers.name
    pattern               = "[timestamp, level = \"ERROR\", ...]"
    metric_namespace      = "${var.project_name}/ApplicationErrors"
    metric_name           = "ErrorCount"
    metric_value          = "1"
    default_value         = "0"
    unit                  = "Count"
    filter_id             = "filter-0a1b2c3d4e5f0001"
    creation_time         = "1705312200000"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-error-filter", ManagedBy = "terraform", MetricType = "error-rate" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

# --- CloudWatch Dashboard (fat — JSON widget definitions) ---
resource "null_resource" "cw_dashboard" {
  triggers = {
    dashboard_arn         = "arn:aws:cloudwatch:${var.region}:123456789012:dashboard/${var.project_name}-overview"
    dashboard_name        = "${var.project_name}-overview"
    dashboard_body_size   = "4096"
    widget_cpu_web        = jsonencode({ type = "metric", x = 0, y = 0, width = 12, height = 6, properties = { metrics = [["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", var.asg_web_name]], region = var.region, title = "Web Tier CPU Utilization", period = 300, stat = "Average" } })
    widget_cpu_app        = jsonencode({ type = "metric", x = 12, y = 0, width = 12, height = 6, properties = { metrics = [["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", var.asg_app_name]], region = var.region, title = "App Tier CPU Utilization", period = 300, stat = "Average" } })
    widget_alb_requests   = jsonencode({ type = "metric", x = 0, y = 6, width = 12, height = 6, properties = { metrics = [["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn]], region = var.region, title = "ALB Request Count", period = 60, stat = "Sum" } })
    widget_rds_connections = jsonencode({ type = "metric", x = 12, y = 6, width = 12, height = 6, properties = { metrics = [["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_primary_id]], region = var.region, title = "RDS Active Connections", period = 300, stat = "Average" } })
    widget_5xx_errors     = jsonencode({ type = "metric", x = 0, y = 12, width = 12, height = 6, properties = { metrics = [["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn]], region = var.region, title = "5XX Error Count", period = 60, stat = "Sum" } })
    widget_rds_cpu        = jsonencode({ type = "metric", x = 12, y = 12, width = 12, height = 6, properties = { metrics = [["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_primary_id]], region = var.region, title = "RDS CPU Utilization", period = 300, stat = "Average" } })
    period_override       = "auto"
    last_modified         = "2026-03-01T00:00:00Z"
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-dashboard", Environment = var.environment, ManagedBy = "terraform", Team = "platform-oncall" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}

# --- EventBridge Rule ---
resource "null_resource" "eventbridge_rule" {
  triggers = {
    rule_arn              = "arn:aws:events:${var.region}:123456789012:rule/${var.project_name}-infra-events"
    name                  = "${var.project_name}-infra-events"
    description           = "Capture infrastructure change events for ${var.project_name} audit trail"
    event_bus_name        = "default"
    event_pattern         = jsonencode({ source = ["aws.ec2", "aws.rds", "aws.elasticloadbalancing", "aws.autoscaling"], "detail-type" = ["AWS API Call via CloudTrail"] })
    state                 = "ENABLED"
    managed_by            = ""
    schedule_expression   = ""
    target_arn            = null_resource.sns_topic.triggers.topic_arn
    target_id             = "${var.project_name}-sns-target"
    target_role_arn       = "arn:aws:iam::123456789012:role/${var.project_name}-eventbridge-role"
    input_transformer     = jsonencode({ inputPathsMap = { source = "$.source", detail_type = "$.detail-type", time = "$.time" } })
    environment           = var.environment
    tags                  = jsonencode({ Name = "${var.project_name}-infra-events", Environment = var.environment, ManagedBy = "terraform", AuditTrail = "enabled" })
    aws_account_id      = "123456789012"
    aws_region          = "us-east-1"
    terraform_workspace = "production"
    resource_status     = "active"
    compliance_check    = "passed"
    last_audit_date     = "2026-03-15T00:00:00Z"
    cost_allocation     = "eng-project42-prod"
    data_classification = "internal"
    backup_enabled      = "true"
    monitoring_enabled  = "true"
    lifecycle_stage     = "production"
    managed_by_pipeline = "github-actions/terraform-deploy"
    change_ticket       = "CHG-2026-00042"
    approved_by         = "platform-team@project42.example.com"
  }
}
