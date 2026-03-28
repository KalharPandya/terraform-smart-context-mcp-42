# --- Key Pair ---
resource "null_resource" "key_pair" {
  triggers = {
    key_name            = "${var.project_name}-keypair"
    key_pair_id         = "key-0a1b2c3d4e5f0001"
    fingerprint         = "ab:cd:ef:12:34:56:78:90:ab:cd:ef:12:34:56:78:90"
    public_key          = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7f8K3v5W2mGq9h1R6x... project42@prod"
    key_type            = "rsa"
    key_format          = "pem"
    create_time         = "2026-01-15T10:00:00Z"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:key-pair/key-0a1b2c3d4e5f0001"
    tags                = jsonencode({ Name = "${var.project_name}-keypair", Environment = var.environment, ManagedBy = "terraform", RotateBy = "2026-07-15" })
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

# --- Instance Profiles ---
resource "null_resource" "instance_profile_web" {
  triggers = {
    profile_name        = "${var.project_name}-web-profile"
    profile_id          = "AIPA0A1B2C3D4E5F6WEB1"
    profile_arn         = "arn:aws:iam::123456789012:instance-profile/${var.project_name}-web-profile"
    role_name           = var.iam_role_web_name
    role_arn            = var.iam_role_web_arn
    path                = "/"
    create_date         = "2026-01-15T10:30:00Z"
    unique_id           = "AIPA0A1B2C3D4E5F6WEB1"
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-web-profile", Environment = var.environment, Tier = "web", ManagedBy = "terraform" })
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

resource "null_resource" "instance_profile_app" {
  triggers = {
    profile_name        = "${var.project_name}-app-profile"
    profile_id          = "AIPA0A1B2C3D4E5F6APP1"
    profile_arn         = "arn:aws:iam::123456789012:instance-profile/${var.project_name}-app-profile"
    role_name           = var.iam_role_app_name
    role_arn            = var.iam_role_app_arn
    path                = "/"
    create_date         = "2026-01-15T10:30:00Z"
    unique_id           = "AIPA0A1B2C3D4E5F6APP1"
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-app-profile", Environment = var.environment, Tier = "app", ManagedBy = "terraform" })
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

# --- Launch Templates ---
resource "null_resource" "launch_template_web" {
  triggers = {
    lt_id               = "lt-web-0a1b2c3d4e5f0001"
    lt_name             = "${var.project_name}-web-lt"
    latest_version      = "1"
    default_version     = "1"
    image_id            = "ami-0a1b2c3d4e5f60001"
    instance_type       = var.instance_type_web
    key_name            = null_resource.key_pair.triggers.key_name
    security_group_id   = var.sg_web_id
    instance_profile    = null_resource.instance_profile_web.triggers.profile_arn
    user_data_base64    = "IyEvYmluL2Jhc2gKZWNobyAid2ViIHRpZXIgYm9vdHN0cmFwIg=="
    monitoring_enabled  = "true"
    ebs_optimized       = "true"
    metadata_http_tokens = "required"
    metadata_hop_limit  = "1"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:launch-template/lt-web-0a1b2c3d4e5f0001"
    tags                = jsonencode({ Name = "${var.project_name}-web-lt", Environment = var.environment, Tier = "web", ManagedBy = "terraform" })
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

resource "null_resource" "launch_template_app" {
  triggers = {
    lt_id               = "lt-app-0a1b2c3d4e5f0002"
    lt_name             = "${var.project_name}-app-lt"
    latest_version      = "1"
    default_version     = "1"
    image_id            = "ami-0a1b2c3d4e5f60002"
    instance_type       = var.instance_type_app
    key_name            = null_resource.key_pair.triggers.key_name
    security_group_id   = var.sg_app_id
    instance_profile    = null_resource.instance_profile_app.triggers.profile_arn
    user_data_base64    = "IyEvYmluL2Jhc2gKZWNobyAiYXBwIHRpZXIgYm9vdHN0cmFwIg=="
    monitoring_enabled  = "true"
    ebs_optimized       = "true"
    metadata_http_tokens = "required"
    metadata_hop_limit  = "1"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:launch-template/lt-app-0a1b2c3d4e5f0002"
    tags                = jsonencode({ Name = "${var.project_name}-app-lt", Environment = var.environment, Tier = "app", ManagedBy = "terraform" })
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

# --- Auto Scaling Groups ---
resource "null_resource" "asg_web" {
  triggers = {
    asg_name            = "${var.project_name}-web-asg"
    asg_arn             = "arn:aws:autoscaling:${var.region}:123456789012:autoScalingGroup:web-asg-id:autoScalingGroupName/${var.project_name}-web-asg"
    min_size            = "2"
    max_size            = "6"
    desired_capacity    = "2"
    launch_template_id  = null_resource.launch_template_web.triggers.lt_id
    launch_template_ver = null_resource.launch_template_web.triggers.latest_version
    vpc_zone_identifier = join(",", var.private_subnet_ids)
    health_check_type   = "ELB"
    health_check_grace  = "300"
    default_cooldown    = "300"
    termination_policies = "OldestInstance,Default"
    service_linked_role = "arn:aws:iam::123456789012:role/aws-service-role/autoscaling.amazonaws.com/AWSServiceRoleForAutoScaling"
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-web-asg", Environment = var.environment, Tier = "web", ManagedBy = "terraform" })
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

resource "null_resource" "asg_app" {
  triggers = {
    asg_name            = "${var.project_name}-app-asg"
    asg_arn             = "arn:aws:autoscaling:${var.region}:123456789012:autoScalingGroup:app-asg-id:autoScalingGroupName/${var.project_name}-app-asg"
    min_size            = "2"
    max_size            = "8"
    desired_capacity    = "2"
    launch_template_id  = null_resource.launch_template_app.triggers.lt_id
    launch_template_ver = null_resource.launch_template_app.triggers.latest_version
    vpc_zone_identifier = join(",", var.private_subnet_ids)
    health_check_type   = "ELB"
    health_check_grace  = "300"
    default_cooldown    = "300"
    termination_policies = "OldestInstance,Default"
    service_linked_role = "arn:aws:iam::123456789012:role/aws-service-role/autoscaling.amazonaws.com/AWSServiceRoleForAutoScaling"
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-app-asg", Environment = var.environment, Tier = "app", ManagedBy = "terraform" })
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

# --- EC2 Instances (Web Tier) ---
resource "null_resource" "web_instance_1" {
  triggers = {
    instance_id         = "i-web-0a1b2c3d4e5f0001"
    private_ip          = "10.0.11.101"
    private_dns         = "ip-10-0-11-101.ec2.internal"
    availability_zone   = var.availability_zones[0]
    subnet_id           = var.private_subnet_ids[0]
    security_group_id   = var.sg_web_id
    instance_type       = var.instance_type_web
    ami_id              = "ami-0a1b2c3d4e5f60001"
    asg_name            = null_resource.asg_web.triggers.asg_name
    instance_profile    = null_resource.instance_profile_web.triggers.profile_name
    key_name            = null_resource.key_pair.triggers.key_name
    instance_state      = "running"
    monitoring_state    = "enabled"
    root_device_type    = "ebs"
    root_volume_id      = "vol-web1-0a1b2c3d4e5f0001"
    root_volume_size    = "50"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:instance/i-web-0a1b2c3d4e5f0001"
    tags                = jsonencode({ Name = "${var.project_name}-web-1", Environment = var.environment, Tier = "web", ManagedBy = "terraform" })
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

resource "null_resource" "web_instance_2" {
  triggers = {
    instance_id         = "i-web-0a1b2c3d4e5f0002"
    private_ip          = "10.0.12.101"
    private_dns         = "ip-10-0-12-101.ec2.internal"
    availability_zone   = var.availability_zones[1]
    subnet_id           = var.private_subnet_ids[1]
    security_group_id   = var.sg_web_id
    instance_type       = var.instance_type_web
    ami_id              = "ami-0a1b2c3d4e5f60001"
    asg_name            = null_resource.asg_web.triggers.asg_name
    instance_profile    = null_resource.instance_profile_web.triggers.profile_name
    key_name            = null_resource.key_pair.triggers.key_name
    instance_state      = "running"
    monitoring_state    = "enabled"
    root_device_type    = "ebs"
    root_volume_id      = "vol-web2-0a1b2c3d4e5f0002"
    root_volume_size    = "50"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:instance/i-web-0a1b2c3d4e5f0002"
    tags                = jsonencode({ Name = "${var.project_name}-web-2", Environment = var.environment, Tier = "web", ManagedBy = "terraform" })
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

# --- EC2 Instances (App Tier) ---
resource "null_resource" "app_instance_1" {
  triggers = {
    instance_id         = "i-app-0a1b2c3d4e5f0001"
    private_ip          = "10.0.11.201"
    private_dns         = "ip-10-0-11-201.ec2.internal"
    availability_zone   = var.availability_zones[0]
    subnet_id           = var.private_subnet_ids[0]
    security_group_id   = var.sg_app_id
    instance_type       = var.instance_type_app
    ami_id              = "ami-0a1b2c3d4e5f60002"
    asg_name            = null_resource.asg_app.triggers.asg_name
    instance_profile    = null_resource.instance_profile_app.triggers.profile_name
    key_name            = null_resource.key_pair.triggers.key_name
    instance_state      = "running"
    monitoring_state    = "enabled"
    root_device_type    = "ebs"
    root_volume_id      = "vol-app1-0a1b2c3d4e5f0001"
    root_volume_size    = "100"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:instance/i-app-0a1b2c3d4e5f0001"
    tags                = jsonencode({ Name = "${var.project_name}-app-1", Environment = var.environment, Tier = "app", ManagedBy = "terraform" })
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

resource "null_resource" "app_instance_2" {
  triggers = {
    instance_id         = "i-app-0a1b2c3d4e5f0002"
    private_ip          = "10.0.12.201"
    private_dns         = "ip-10-0-12-201.ec2.internal"
    availability_zone   = var.availability_zones[1]
    subnet_id           = var.private_subnet_ids[1]
    security_group_id   = var.sg_app_id
    instance_type       = var.instance_type_app
    ami_id              = "ami-0a1b2c3d4e5f60002"
    asg_name            = null_resource.asg_app.triggers.asg_name
    instance_profile    = null_resource.instance_profile_app.triggers.profile_name
    key_name            = null_resource.key_pair.triggers.key_name
    instance_state      = "running"
    monitoring_state    = "enabled"
    root_device_type    = "ebs"
    root_volume_id      = "vol-app2-0a1b2c3d4e5f0002"
    root_volume_size    = "100"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:instance/i-app-0a1b2c3d4e5f0002"
    tags                = jsonencode({ Name = "${var.project_name}-app-2", Environment = var.environment, Tier = "app", ManagedBy = "terraform" })
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

# --- Scaling Policies ---
resource "null_resource" "scaling_policy_web" {
  triggers = {
    policy_arn          = "arn:aws:autoscaling:${var.region}:123456789012:scalingPolicy:web-policy-id:autoScalingGroupName/${var.project_name}-web-asg:policyName/web-scale-up"
    policy_name         = "${var.project_name}-web-scale-up"
    policy_type         = "SimpleScaling"
    asg_name            = null_resource.asg_web.triggers.asg_name
    adjustment_type     = "ChangeInCapacity"
    scaling_adjustment  = "1"
    cooldown            = "300"
    min_adjustment_magnitude = "0"
    estimated_warmup    = "300"
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-web-scale-up", ManagedBy = "terraform" })
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

resource "null_resource" "scaling_policy_app" {
  triggers = {
    policy_arn          = "arn:aws:autoscaling:${var.region}:123456789012:scalingPolicy:app-policy-id:autoScalingGroupName/${var.project_name}-app-asg:policyName/app-scale-up"
    policy_name         = "${var.project_name}-app-scale-up"
    policy_type         = "SimpleScaling"
    asg_name            = null_resource.asg_app.triggers.asg_name
    adjustment_type     = "ChangeInCapacity"
    scaling_adjustment  = "2"
    cooldown            = "300"
    min_adjustment_magnitude = "0"
    estimated_warmup    = "300"
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-app-scale-up", ManagedBy = "terraform" })
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

# --- CloudWatch Alarms for ASG ---
resource "null_resource" "cw_alarm_asg_web" {
  triggers = {
    alarm_arn           = "arn:aws:cloudwatch:${var.region}:123456789012:alarm:${var.project_name}-web-cpu"
    alarm_name          = "${var.project_name}-web-cpu-high"
    alarm_description   = "Triggers when web tier CPU exceeds 75% for 10 minutes"
    metric_name         = "CPUUtilization"
    namespace           = "AWS/EC2"
    statistic           = "Average"
    period              = "300"
    threshold           = "75"
    comparison_operator = "GreaterThanThreshold"
    evaluation_periods  = "2"
    datapoints_to_alarm = "2"
    treat_missing_data  = "missing"
    asg_name            = null_resource.asg_web.triggers.asg_name
    alarm_actions       = null_resource.scaling_policy_web.triggers.policy_arn
    ok_actions          = ""
    insufficient_data_actions = ""
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-web-cpu-alarm", ManagedBy = "terraform", Severity = "warning" })
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

resource "null_resource" "cw_alarm_asg_app" {
  triggers = {
    alarm_arn           = "arn:aws:cloudwatch:${var.region}:123456789012:alarm:${var.project_name}-app-cpu"
    alarm_name          = "${var.project_name}-app-cpu-high"
    alarm_description   = "Triggers when app tier CPU exceeds 70% for 10 minutes"
    metric_name         = "CPUUtilization"
    namespace           = "AWS/EC2"
    statistic           = "Average"
    period              = "300"
    threshold           = "70"
    comparison_operator = "GreaterThanThreshold"
    evaluation_periods  = "2"
    datapoints_to_alarm = "2"
    treat_missing_data  = "missing"
    asg_name            = null_resource.asg_app.triggers.asg_name
    alarm_actions       = null_resource.scaling_policy_app.triggers.policy_arn
    ok_actions          = ""
    insufficient_data_actions = ""
    environment         = var.environment
    tags                = jsonencode({ Name = "${var.project_name}-app-cpu-alarm", ManagedBy = "terraform", Severity = "warning" })
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

# --- Bastion Host ---
resource "null_resource" "bastion" {
  triggers = {
    instance_id         = "i-bastion-0a1b2c3d4e5f0001"
    public_ip           = "54.210.167.100"
    public_dns          = "ec2-54-210-167-100.compute-1.amazonaws.com"
    private_ip          = "10.0.1.50"
    private_dns         = "ip-10-0-1-50.ec2.internal"
    availability_zone   = var.availability_zones[0]
    subnet_id           = var.public_subnet_ids[0]
    security_group_id   = var.sg_alb_id
    instance_type       = "t3.micro"
    ami_id              = "ami-0a1b2c3d4e5f60003"
    key_name            = null_resource.key_pair.triggers.key_name
    instance_profile    = null_resource.instance_profile_web.triggers.profile_name
    instance_state      = "running"
    monitoring_state    = "enabled"
    root_device_type    = "ebs"
    root_volume_id      = "vol-bastion-0a1b2c3d4e5f0001"
    root_volume_size    = "20"
    environment         = var.environment
    arn                 = "arn:aws:ec2:${var.region}:123456789012:instance/i-bastion-0a1b2c3d4e5f0001"
    tags                = jsonencode({ Name = "${var.project_name}-bastion", Environment = var.environment, Tier = "management", ManagedBy = "terraform", AllowSSH = "true" })
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
