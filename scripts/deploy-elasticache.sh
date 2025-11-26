#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="semantic-cache-demo-infrastructure"
TEMPLATE_FILE="infrastructure/cloudformation/elasticache-stack.yaml"
AWS_PROFILE="semantic-cache-demo"
DEFAULT_AWS_REGION="us-east-2"

print_header() {
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
}

print_step() {
  local step=$1
  local message=$2
  echo -e "${YELLOW}[$step]${NC} $message"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}Error: $1${NC}"
}

get_aws_region() {
  # Try to get region from profile config, fall back to default
  local profile_region=$(aws configure get region --profile $AWS_PROFILE 2>/dev/null || echo "")

  if [ -n "$profile_region" ]; then
    echo "$profile_region"
  else
    echo "$DEFAULT_AWS_REGION"
  fi
}

verify_credentials() {
  print_step "1/5" "Verifying AWS credentials..."

  if ! aws sts get-caller-identity --profile $AWS_PROFILE >/dev/null 2>&1; then
    print_error "AWS credentials not configured for profile '$AWS_PROFILE'"
    echo "Please configure credentials in ~/.aws/credentials"
    exit 1
  fi

  local account_id=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
  print_success "Authenticated as AWS Account: $account_id"
  echo ""
}

validate_template() {
  print_step "2/5" "Validating CloudFormation template..."

  if
    ! aws cloudformation validate-template \
      --template-body file://$TEMPLATE_FILE \
      --profile $AWS_PROFILE
    --region $AWS_REGION >/dev/null 2>&1
  then
    print_error "Template validation failed"
    exit 1
  fi
}

main() {
  # Get AWS region (from profile config or default)
  AWS_REGION=$(get_aws_region)

  print_header "ElastiCache Cluster Deployment"
  echo "Region: $AWS_REGION"
  echo ""

  verify_credentials
  validate_template
  #
  # local action=$(check_stack_status)
  # deploy_stack "$action"
  # display_outputs
  # print_next_steps
}

main "$@"
