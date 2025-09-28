terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_kms_key" "documents" {
  description             = "Haizel envelope encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_s3_bucket" "documents" {
  bucket = "${var.environment}-haizel-documents"

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = aws_kms_key.documents.arn
      }
    }
  }
}

resource "aws_sqs_queue" "webhooks" {
  name                        = "${var.environment}-webhooks"
  message_retention_seconds   = 1209600
  visibility_timeout_seconds  = 30
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.webhooks_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue" "webhooks_dlq" {
  name                      = "${var.environment}-webhooks-dlq"
  message_retention_seconds = 1209600
}

resource "aws_secretsmanager_secret" "vendor" {
  name        = "${var.environment}/haizel/vendor"
  description = "Vendor credential bundle"
}

resource "aws_ecs_cluster" "observability" {
  name = "${var.environment}-otel"
}

resource "aws_ecs_task_definition" "otel_collector" {
  family                   = "${var.environment}-otel-collector"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "otelcol"
      image     = "otel/opentelemetry-collector-contrib:0.100.0"
      command   = ["--config=env:OTEL_CONFIG"]
      essential = true
      portMappings = [
        {
          containerPort = 4317
          hostPort       = 4317
          protocol       = "tcp"
        },
        {
          containerPort = 4318
          hostPort       = 4318
          protocol       = "tcp"
        }
      ]
      environment = [
        {
          name  = "OTEL_CONFIG"
          value = <<-EOT
receivers:
  otlp:
    protocols:
      grpc:
      http:
processors:
  batch: {}
exporters:
  otlp:
    endpoint: "${var.tracing_backend_endpoint}"
    tls:
      insecure: ${var.tracing_backend_insecure}
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
EOT
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/aws/ecs/${var.environment}-otel"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "otel"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "otel_collector" {
  name            = "${var.environment}-otel"
  cluster         = aws_ecs_cluster.observability.id
  task_definition = aws_ecs_task_definition.otel_collector.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.collector_subnet_ids
    security_groups = var.collector_security_group_ids
    assign_public_ip = false
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "sandbox"
}

variable "collector_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for deploying the OTEL collector"
}

variable "collector_security_group_ids" {
  type        = list(string)
  description = "Security groups allowing traffic to the OTEL collector"
}

variable "tracing_backend_endpoint" {
  type        = string
  description = "OTLP endpoint for exporting production traces"
}

variable "tracing_backend_insecure" {
  type        = bool
  description = "Whether to disable TLS validation for the tracing exporter"
  default     = false
}

variable "ecs_task_execution_role_arn" {
  type        = string
  description = "IAM role ARN granting ECS execution permissions"
}

variable "ecs_task_role_arn" {
  type        = string
  description = "IAM role ARN assumed by the OTEL collector task"
}
