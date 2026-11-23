resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_security_group" "app" {
  name   = "${local.name}-app"
  vpc_id = module.vpc.vpc_id
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # tighten to VPC endpoints + webhook egress proxy in a later iteration
  }
}

data "aws_iam_policy_document" "assume_ecs" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-exec"
  assume_role_policy = data.aws_iam_policy_document.assume_ecs.json
}
resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "execution_secrets" {
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = aws_secretsmanager_secret.app.arn },
      { Effect = "Allow", Action = ["kms:Decrypt"], Resource = aws_kms_key.main.arn },
    ]
  })
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.assume_ecs.json
}
resource "aws_iam_role_policy" "task_ses" {
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["ses:SendEmail", "ses:SendRawEmail"], Resource = aws_sesv2_email_identity.domain.arn }]
  })
}

locals {
  container_env = [
    { name = "APP_URL", value = local.app_url },
    { name = "EMAIL_TRANSPORT", value = "ses" },
    { name = "EMAIL_FROM", value = "Meritbox <no-reply@${var.domain}>" },
    { name = "SECURITY_CONTACT", value = "mailto:${var.security_contact_email}" },
  ]
  container_secrets = [
    { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::" },
    { name = "MERITBOX_MASTER_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:MERITBOX_MASTER_KEY::" },
  ]
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
  container_definitions = jsonencode([{
    name                   = "app"
    image                  = var.image
    essential              = true
    readonlyRootFilesystem = true
    user                   = "10001"
    portMappings           = [{ containerPort = 3000 }]
    environment            = local.container_env
    secrets                = local.container_secrets
    mountPoints            = [{ sourceVolume = "tmp", containerPath = "/tmp" }, { sourceVolume = "cache", containerPath = "/app/.next/cache" }]
    linuxParameters        = { capabilities = { drop = ["ALL"] }, initProcessEnabled = true }
    logConfiguration = {
      logDriver = "awslogs"
      options   = { awslogs-group = aws_cloudwatch_log_group.app.name, awslogs-region = "ap-southeast-2", awslogs-stream-prefix = "app" }
    }
  }])
  volume { name = "tmp" }
  volume { name = "cache" }
}

resource "aws_ecs_service" "app" {
  name            = "app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3
  launch_type     = "FARGATE"
  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.app.id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}
