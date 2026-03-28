# --- Security Group Chain: ALB -> Web -> App -> DB (4-hop) ---

resource "null_resource" "sg_alb" {
  triggers = {
    sg_id               = "sg-alb-0a1b2c3d4e5f0001"
    vpc_id              = var.vpc_id
    name                = "${var.project_name}-sg-alb"
    description         = "Security group for Application Load Balancer - allows inbound HTTPS from internet"
    ingress_from_port   = "443"
    ingress_to_port     = "443"
    ingress_protocol    = "tcp"
    ingress_cidr        = "0.0.0.0/0"
    ingress_ipv6_cidr   = "::/0"
    egress_from_port    = "0"
    egress_to_port      = "65535"
    egress_protocol     = "-1"
    egress_cidr         = "0.0.0.0/0"
    owner_id            = "123456789012"
    environment         = var.environment
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group/sg-alb-0a1b2c3d4e5f0001"
    revoke_rules_on_delete = "true"
    tags                = jsonencode({ Name = "${var.project_name}-sg-alb", Environment = var.environment, Tier = "public", ManagedBy = "terraform", Compliance = "pci-dss" })
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

resource "null_resource" "sg_web" {
  triggers = {
    sg_id               = "sg-web-0a1b2c3d4e5f0002"
    vpc_id              = var.vpc_id
    name                = "${var.project_name}-sg-web"
    description         = "Security group for web tier instances - allows inbound from ALB only"
    ingress_from_port   = "8080"
    ingress_to_port     = "8080"
    ingress_protocol    = "tcp"
    ingress_source_sg   = null_resource.sg_alb.triggers.sg_id
    ingress_description = "Allow HTTP traffic from ALB security group"
    egress_from_port    = "0"
    egress_to_port      = "65535"
    egress_protocol     = "-1"
    egress_cidr         = "0.0.0.0/0"
    owner_id            = "123456789012"
    environment         = var.environment
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group/sg-web-0a1b2c3d4e5f0002"
    revoke_rules_on_delete = "true"
    tags                = jsonencode({ Name = "${var.project_name}-sg-web", Environment = var.environment, Tier = "web", ManagedBy = "terraform", Compliance = "pci-dss" })
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

resource "null_resource" "sg_app" {
  triggers = {
    sg_id               = "sg-app-0a1b2c3d4e5f0003"
    vpc_id              = var.vpc_id
    name                = "${var.project_name}-sg-app"
    description         = "Security group for app tier instances - allows inbound from web tier only"
    ingress_from_port   = "3000"
    ingress_to_port     = "3000"
    ingress_protocol    = "tcp"
    ingress_source_sg   = null_resource.sg_web.triggers.sg_id
    ingress_description = "Allow API traffic from web tier security group"
    egress_from_port    = "0"
    egress_to_port      = "65535"
    egress_protocol     = "-1"
    egress_cidr         = "0.0.0.0/0"
    owner_id            = "123456789012"
    environment         = var.environment
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group/sg-app-0a1b2c3d4e5f0003"
    revoke_rules_on_delete = "true"
    tags                = jsonencode({ Name = "${var.project_name}-sg-app", Environment = var.environment, Tier = "app", ManagedBy = "terraform", Compliance = "pci-dss" })
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

resource "null_resource" "sg_db" {
  triggers = {
    sg_id               = "sg-db-0a1b2c3d4e5f0004"
    vpc_id              = var.vpc_id
    name                = "${var.project_name}-sg-db"
    description         = "Security group for database tier - allows inbound from app tier only on port 5432"
    ingress_from_port   = "5432"
    ingress_to_port     = "5432"
    ingress_protocol    = "tcp"
    ingress_source_sg   = null_resource.sg_app.triggers.sg_id
    ingress_description = "Allow PostgreSQL connections from app tier security group"
    egress_from_port    = "0"
    egress_to_port      = "65535"
    egress_protocol     = "-1"
    egress_cidr         = "10.0.0.0/16"
    owner_id            = "123456789012"
    environment         = var.environment
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group/sg-db-0a1b2c3d4e5f0004"
    revoke_rules_on_delete = "true"
    tags                = jsonencode({ Name = "${var.project_name}-sg-db", Environment = var.environment, Tier = "database", ManagedBy = "terraform", Compliance = "pci-dss", DataClassification = "confidential" })
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

# --- Security Group Rules (one per SG for additional granularity) ---

resource "null_resource" "sg_rule_alb" {
  triggers = {
    rule_id             = "sgr-alb-0a1b2c3d4e5f0001"
    security_group_id   = null_resource.sg_alb.triggers.sg_id
    type                = "ingress"
    from_port           = "80"
    to_port             = "80"
    protocol            = "tcp"
    cidr_blocks         = "0.0.0.0/0"
    ipv6_cidr_blocks    = "::/0"
    description         = "Allow HTTP traffic for redirect to HTTPS"
    self                = "false"
    prefix_list_ids     = ""
    security_group_owner_id = "123456789012"
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group-rule/sgr-alb-0a1b2c3d4e5f0001"
    tags                = jsonencode({ Name = "${var.project_name}-sgr-alb-http", ManagedBy = "terraform" })
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

resource "null_resource" "sg_rule_web" {
  triggers = {
    rule_id             = "sgr-web-0a1b2c3d4e5f0002"
    security_group_id   = null_resource.sg_web.triggers.sg_id
    type                = "ingress"
    from_port           = "22"
    to_port             = "22"
    protocol            = "tcp"
    source_sg_id        = null_resource.sg_alb.triggers.sg_id
    description         = "Allow SSH from bastion via ALB SG for emergency access"
    self                = "false"
    prefix_list_ids     = ""
    security_group_owner_id = "123456789012"
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group-rule/sgr-web-0a1b2c3d4e5f0002"
    tags                = jsonencode({ Name = "${var.project_name}-sgr-web-ssh", ManagedBy = "terraform" })
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

resource "null_resource" "sg_rule_app" {
  triggers = {
    rule_id             = "sgr-app-0a1b2c3d4e5f0003"
    security_group_id   = null_resource.sg_app.triggers.sg_id
    type                = "ingress"
    from_port           = "8443"
    to_port             = "8443"
    protocol            = "tcp"
    source_sg_id        = null_resource.sg_web.triggers.sg_id
    description         = "Allow internal API traffic from web tier on secure port"
    self                = "false"
    prefix_list_ids     = ""
    security_group_owner_id = "123456789012"
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group-rule/sgr-app-0a1b2c3d4e5f0003"
    tags                = jsonencode({ Name = "${var.project_name}-sgr-app-api", ManagedBy = "terraform" })
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

resource "null_resource" "sg_rule_db" {
  triggers = {
    rule_id             = "sgr-db-0a1b2c3d4e5f0004"
    security_group_id   = null_resource.sg_db.triggers.sg_id
    type                = "ingress"
    from_port           = "6379"
    to_port             = "6379"
    protocol            = "tcp"
    source_sg_id        = null_resource.sg_app.triggers.sg_id
    description         = "Allow Redis access from app tier for session and cache"
    self                = "false"
    prefix_list_ids     = ""
    security_group_owner_id = "123456789012"
    arn                 = "arn:aws:ec2:us-east-1:123456789012:security-group-rule/sgr-db-0a1b2c3d4e5f0004"
    tags                = jsonencode({ Name = "${var.project_name}-sgr-db-redis", ManagedBy = "terraform" })
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

# --- IAM Roles ---

resource "null_resource" "iam_role_web" {
  triggers = {
    role_arn             = "arn:aws:iam::123456789012:role/${var.project_name}-web-role"
    role_name            = "${var.project_name}-web-role"
    role_id              = "AROA0A1B2C3D4E5F6WEB1"
    assume_role_policy   = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
    path                 = "/"
    max_session_duration = "3600"
    create_date          = "2026-01-15T10:30:00Z"
    unique_id            = "AROA0A1B2C3D4E5F6WEB1"
    permissions_boundary = ""
    description          = "IAM role for web tier EC2 instances"
    environment          = var.environment
    tags                 = jsonencode({ Name = "${var.project_name}-web-role", Environment = var.environment, Tier = "web", ManagedBy = "terraform", Compliance = "soc2" })
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

resource "null_resource" "iam_role_app" {
  triggers = {
    role_arn             = "arn:aws:iam::123456789012:role/${var.project_name}-app-role"
    role_name            = "${var.project_name}-app-role"
    role_id              = "AROA0A1B2C3D4E5F6APP1"
    assume_role_policy   = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
    path                 = "/"
    max_session_duration = "3600"
    create_date          = "2026-01-15T10:30:00Z"
    unique_id            = "AROA0A1B2C3D4E5F6APP1"
    permissions_boundary = ""
    description          = "IAM role for app tier EC2 instances"
    environment          = var.environment
    tags                 = jsonencode({ Name = "${var.project_name}-app-role", Environment = var.environment, Tier = "app", ManagedBy = "terraform", Compliance = "soc2" })
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

resource "null_resource" "iam_role_db" {
  triggers = {
    role_arn             = "arn:aws:iam::123456789012:role/${var.project_name}-db-role"
    role_name            = "${var.project_name}-db-role"
    role_id              = "AROA0A1B2C3D4E5F6DB01"
    assume_role_policy   = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "rds.amazonaws.com" }, Action = "sts:AssumeRole" }] })
    path                 = "/"
    max_session_duration = "3600"
    create_date          = "2026-01-15T10:30:00Z"
    unique_id            = "AROA0A1B2C3D4E5F6DB01"
    permissions_boundary = ""
    description          = "IAM role for RDS enhanced monitoring"
    environment          = var.environment
    tags                 = jsonencode({ Name = "${var.project_name}-db-role", Environment = var.environment, Tier = "database", ManagedBy = "terraform", Compliance = "soc2" })
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

# --- IAM Policy Attachments ---

resource "null_resource" "iam_policy_web" {
  triggers = {
    attachment_id       = "${var.project_name}-web-policy-attachment"
    role                = null_resource.iam_role_web.triggers.role_name
    policy_arn          = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
    policy_name         = "AmazonS3ReadOnlyAccess"
    policy_type         = "AWS managed"
    role_arn            = null_resource.iam_role_web.triggers.role_arn
    description         = "Read-only S3 access for static asset serving"
    environment         = var.environment
    attached_at         = "2026-01-15T10:35:00Z"
    tags                = jsonencode({ Name = "${var.project_name}-web-policy", ManagedBy = "terraform", Scope = "s3-readonly" })
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

resource "null_resource" "iam_policy_app" {
  triggers = {
    attachment_id       = "${var.project_name}-app-policy-attachment"
    role                = null_resource.iam_role_app.triggers.role_name
    policy_arn          = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
    policy_name         = "AmazonSQSFullAccess"
    policy_type         = "AWS managed"
    role_arn            = null_resource.iam_role_app.triggers.role_arn
    description         = "Full SQS access for async job processing"
    environment         = var.environment
    attached_at         = "2026-01-15T10:35:00Z"
    tags                = jsonencode({ Name = "${var.project_name}-app-policy", ManagedBy = "terraform", Scope = "sqs-full" })
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

resource "null_resource" "iam_policy_db" {
  triggers = {
    attachment_id       = "${var.project_name}-db-policy-attachment"
    role                = null_resource.iam_role_db.triggers.role_name
    policy_arn          = "arn:aws:iam::aws:policy/AmazonRDSEnhancedMonitoringRole"
    policy_name         = "AmazonRDSEnhancedMonitoringRole"
    policy_type         = "AWS managed"
    role_arn            = null_resource.iam_role_db.triggers.role_arn
    description         = "Enhanced monitoring for RDS instances"
    environment         = var.environment
    attached_at         = "2026-01-15T10:35:00Z"
    tags                = jsonencode({ Name = "${var.project_name}-db-policy", ManagedBy = "terraform", Scope = "rds-monitoring" })
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
