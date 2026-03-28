project_name = "project42-prod"
environment  = "production"
region       = "us-east-1"
vpc_cidr     = "10.0.0.0/16"

public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
db_subnet_cidrs      = ["10.0.21.0/24", "10.0.22.0/24"]

availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

instance_type_web = "t3.large"
instance_type_app = "t3.xlarge"
db_instance_class = "db.r6g.xlarge"
db_engine_version = "15.4"
domain_name       = "app.project42.example.com"
