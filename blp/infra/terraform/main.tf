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

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "sandbox"
}
