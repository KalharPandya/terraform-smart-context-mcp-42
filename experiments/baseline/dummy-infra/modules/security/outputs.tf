output "sg_alb_id" {
  value = null_resource.sg_alb.triggers.sg_id
}

output "sg_web_id" {
  value = null_resource.sg_web.triggers.sg_id
}

output "sg_app_id" {
  value = null_resource.sg_app.triggers.sg_id
}

output "sg_db_id" {
  value = null_resource.sg_db.triggers.sg_id
}

output "iam_role_web_arn" {
  value = null_resource.iam_role_web.triggers.role_arn
}

output "iam_role_app_arn" {
  value = null_resource.iam_role_app.triggers.role_arn
}

output "iam_role_db_arn" {
  value = null_resource.iam_role_db.triggers.role_arn
}

output "iam_role_web_name" {
  value = null_resource.iam_role_web.triggers.role_name
}

output "iam_role_app_name" {
  value = null_resource.iam_role_app.triggers.role_name
}
