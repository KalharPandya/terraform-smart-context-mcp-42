# Root module — wires all 6 modules with cross-module dependencies
# Dependency chain: networking -> security -> compute/database -> loadbalancer -> monitoring

module "networking" {
  source = "./modules/networking"

  project_name         = var.project_name
  environment          = var.environment
  region               = var.region
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  db_subnet_cidrs      = var.db_subnet_cidrs
  availability_zones   = var.availability_zones
}

module "security" {
  source = "./modules/security"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.networking.vpc_id
}

module "compute" {
  source = "./modules/compute"

  project_name       = var.project_name
  environment        = var.environment
  region             = var.region
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  sg_web_id          = module.security.sg_web_id
  sg_app_id          = module.security.sg_app_id
  sg_alb_id          = module.security.sg_alb_id
  iam_role_web_arn   = module.security.iam_role_web_arn
  iam_role_app_arn   = module.security.iam_role_app_arn
  iam_role_web_name  = module.security.iam_role_web_name
  iam_role_app_name  = module.security.iam_role_app_name
  instance_type_web  = var.instance_type_web
  instance_type_app  = var.instance_type_app
  availability_zones = var.availability_zones
}

module "database" {
  source = "./modules/database"

  project_name       = var.project_name
  environment        = var.environment
  region             = var.region
  db_subnet_ids      = module.networking.db_subnet_ids
  private_subnet_ids = module.networking.private_subnet_ids
  sg_db_id           = module.security.sg_db_id
  sg_app_id          = module.security.sg_app_id
  db_instance_class  = var.db_instance_class
  db_engine_version  = var.db_engine_version
  availability_zones = var.availability_zones
}

module "loadbalancer" {
  source = "./modules/loadbalancer"

  project_name      = var.project_name
  environment       = var.environment
  region            = var.region
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  sg_alb_id         = module.security.sg_alb_id
  domain_name       = var.domain_name
}

module "monitoring" {
  source = "./modules/monitoring"

  project_name   = var.project_name
  environment    = var.environment
  region         = var.region
  asg_web_name   = module.compute.asg_web_name
  asg_app_name   = module.compute.asg_app_name
  alb_arn        = module.loadbalancer.alb_arn
  rds_endpoint   = module.database.rds_endpoint
  rds_primary_id = module.database.rds_primary_id
}
