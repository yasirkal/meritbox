resource "random_password" "db" {
  length  = 40
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = module.vpc.database_subnets
}

resource "aws_db_parameter_group" "pg" {
  name   = "${local.name}-pg16"
  family = "postgres16"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
}

resource "aws_security_group" "db" {
  name   = "${local.name}-db"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

resource "aws_db_instance" "main" {
  identifier                   = local.name
  engine                       = "postgres"
  engine_version               = "16"
  instance_class               = "db.m7g.large"
  allocated_storage            = 50
  max_allocated_storage        = 500
  storage_encrypted            = true
  kms_key_id                   = aws_kms_key.main.arn
  db_name                      = "meritbox"
  username                     = "meritbox"
  password                     = random_password.db.result
  multi_az                     = true
  db_subnet_group_name         = aws_db_subnet_group.main.name
  vpc_security_group_ids       = [aws_security_group.db.id]
  parameter_group_name         = aws_db_parameter_group.pg.name
  backup_retention_period      = 35
  deletion_protection          = true
  publicly_accessible          = false
  auto_minor_version_upgrade   = true
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.main.arn
  iam_database_authentication_enabled = true
  copy_tags_to_snapshot        = true
  final_snapshot_identifier    = "${local.name}-final"
}

# Cross-region (Melbourne) automated backup replication keeps DR copies onshore.
provider "aws" {
  alias  = "melbourne"
  region = "ap-southeast-4"
}
resource "aws_kms_key" "melbourne" {
  provider            = aws.melbourne
  description         = "${local.name} DR backups"
  enable_key_rotation = true
}
resource "aws_db_instance_automated_backups_replication" "dr" {
  provider               = aws.melbourne
  source_db_instance_arn = aws_db_instance.main.arn
  kms_key_id             = aws_kms_key.melbourne.arn
  retention_period       = 14
}

resource "random_bytes" "master_key" { length = 32 }

resource "aws_secretsmanager_secret" "app" {
  name       = "${local.name}/app"
  kms_key_id = aws_kms_key.main.arn
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL        = "postgresql://meritbox:${random_password.db.result}@${aws_db_instance.main.address}:5432/meritbox?schema=public&sslmode=require"
    MERITBOX_MASTER_KEY = random_bytes.master_key.base64
  })
}
