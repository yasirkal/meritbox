terraform {
  required_version = ">= 1.6"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # backend "s3" { bucket = "meritbox-tfstate" key = "prod/terraform.tfstate" region = "ap-southeast-2" encrypt = true use_lockfile = true }
}

provider "aws" {
  region = "ap-southeast-2"
  default_tags { tags = { Project = "meritbox", Environment = var.environment, DataClassification = "PROTECTED-candidate" } }
}

provider "aws" {
  alias  = "us_east_1" # Route 53 DNSSEC KSKs must use a KMS key in us-east-1 (key material only; no customer data)
  region = "us-east-1"
}

variable "environment" { default = "prod" }
variable "domain" {
  description = "Apex domain, e.g. meritbox.com.au"
  type        = string
}
variable "image" {
  description = "Container image URI (ECR, ap-southeast-2)"
  type        = string
}
variable "security_contact_email" { default = "security@meritbox.com.au" }

locals {
  name    = "meritbox-${var.environment}"
  app_url = "https://${var.domain}"
}

data "aws_caller_identity" "me" {}

module "vpc" {
  source             = "terraform-aws-modules/vpc/aws"
  version            = "~> 5.13"
  name               = local.name
  cidr               = "10.40.0.0/16"
  azs                = ["ap-southeast-2a", "ap-southeast-2b", "ap-southeast-2c"]
  public_subnets     = ["10.40.0.0/24", "10.40.1.0/24", "10.40.2.0/24"]
  private_subnets    = ["10.40.10.0/24", "10.40.11.0/24", "10.40.12.0/24"]
  database_subnets   = ["10.40.20.0/24", "10.40.21.0/24", "10.40.22.0/24"]
  enable_nat_gateway = true
  single_nat_gateway = false
  enable_flow_log    = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true
}

resource "aws_kms_key" "main" {
  description         = "${local.name} data encryption"
  enable_key_rotation = true
}
