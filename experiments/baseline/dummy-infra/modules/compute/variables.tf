variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "sg_web_id" {
  type = string
}

variable "sg_app_id" {
  type = string
}

variable "sg_alb_id" {
  type = string
}

variable "iam_role_web_arn" {
  type = string
}

variable "iam_role_app_arn" {
  type = string
}

variable "iam_role_web_name" {
  type = string
}

variable "iam_role_app_name" {
  type = string
}

variable "instance_type_web" {
  type = string
}

variable "instance_type_app" {
  type = string
}

variable "availability_zones" {
  type = list(string)
}
