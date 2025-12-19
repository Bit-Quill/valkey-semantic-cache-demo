import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface AgentCoreStackProps extends cdk.StackProps {
  vpcId: string;
  subnetIds: string[];
  securityGroupId: string;
  elastiCacheEndpoint: string;
  projectName?: string;
  agentName?: string;
}

export class AgentCoreStack extends cdk.Stack {
  public readonly runtimeRole: iam.Role;
  public readonly codeBuildRole: iam.Role;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const region = this.region;
    const account = this.account;
    const projectName = props.projectName || 'semantic-cache-demo';
    const agentName = props.agentName || 'semantic_cache_demo';

    //
    // S3 Bucket for CodeBuild Sources
    //
    const codeBuildSourceBucket = new s3.Bucket(this, 'CodeBuildSourceBucket', {
      bucketName: `${projectName}-agentcore-sources-${account}-${region}`,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{
        id: 'CleanupOldSources',
        enabled: true,
        noncurrentVersionExpiration: cdk.Duration.days(7),
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    cdk.Tags.of(codeBuildSourceBucket).add('Name', `${projectName}-codebuild-sources`);
    cdk.Tags.of(codeBuildSourceBucket).add('Project', 'valkey-semantic-cache-demo');

    //
    // ECR Repository for Agent Container
    //
    const agentECRRepository = new ecr.Repository(this, 'AgentECRRepository', {
      repositoryName: `bedrock-agentcore-${agentName}`,
      imageScanOnPush: true,
      lifecycleRules: [{
        rulePriority: 1,
        description: 'Keep only 5 most recent images',
        tagStatus: ecr.TagStatus.ANY,
        maxImageCount: 5,
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    cdk.Tags.of(agentECRRepository).add('Name', `${projectName}-agent-ecr`);
    cdk.Tags.of(agentECRRepository).add('Project', 'valkey-semantic-cache-demo');

    //
    // CodeBuild IAM Role
    //
    this.codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
      roleName: `AgentCoreCodeBuild-${region}`,
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    });

    cdk.Tags.of(this.codeBuildRole).add('Name', `${projectName}-codebuild-role`);
    cdk.Tags.of(this.codeBuildRole).add('Project', 'valkey-semantic-cache-demo');

    // CloudWatch Logs - for build logging
    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogsPolicy',
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/codebuild/*`],
    }));

    // S3 - for downloading source code
    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3SourceAccessPolicy',
      actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:GetBucketVersioning'],
      resources: [
        `arn:aws:s3:::bedrock-agentcore-codebuild-sources-${account}-${region}`,
        `arn:aws:s3:::bedrock-agentcore-codebuild-sources-${account}-${region}/*`,
      ],
    }));

    // ECR - for pushing container images
    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRAuthPolicy',
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));

    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRPushPolicy',
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:DescribeRepositories',
        'ecr:CreateRepository',
        'ecr:TagResource',
      ],
      resources: [agentECRRepository.repositoryArn],
    }));

    // CodeBuild - for project management (AgentCore may need this)
    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CodeBuildSelfManagement',
      actions: [
        'codebuild:CreateReportGroup',
        'codebuild:CreateReport',
        'codebuild:UpdateReport',
        'codebuild:BatchPutTestCases',
        'codebuild:BatchPutCodeCoverages',
      ],
      resources: [`arn:aws:codebuild:${region}:${account}:report-group/*`],
    }));

    //
    // Runtime IAM Role (for deployed agent)
    //
    this.runtimeRole = new iam.Role(this, 'RuntimeRole', {
      roleName: `AgentCoreRuntime-${region}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
        new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com')
      ),
    });

    cdk.Tags.of(this.runtimeRole).add('Name', `${projectName}-runtime-role`);
    cdk.Tags.of(this.runtimeRole).add('Project', 'valkey-semantic-cache-demo');

    // Bedrock - for model invocation (Claude, Titan Embeddings)
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockInvokePolicy',
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:Converse',
        'bedrock:ConverseStream',
      ],
      resources: [
        // Foundation models in local region
        `arn:aws:bedrock:${region}::foundation-model/anthropic.*`,
        `arn:aws:bedrock:${region}::foundation-model/amazon.*`,
        // Foundation models in all US regions (for cross-region inference profiles)
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.*',
        'arn:aws:bedrock:us-east-1::foundation-model/amazon.*',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.*',
        'arn:aws:bedrock:us-west-2::foundation-model/amazon.*',
        // Cross-region inference profiles
        `arn:aws:bedrock:${region}:${account}:inference-profile/us.anthropic.*`,
        `arn:aws:bedrock:${region}:${account}:inference-profile/us.amazon.*`,
      ],
    }));

    // CloudWatch - for metrics
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchMetricsPolicy',
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': 'SemanticSupportDesk' },
      },
    }));

    // CloudWatch - for logging
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogsPolicy',
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
      ],
      resources: [
        `arn:aws:logs:${region}:${account}:log-group:/aws/bedrock/*`,
        `arn:aws:logs:${region}:${account}:log-group:/aws/bedrock-agentcore/*`,
        `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/*`,
      ],
    }));

    // VPC - for ElastiCache access
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      sid: 'VPCAccessPolicy',
      actions: [
        'ec2:CreateNetworkInterface',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DeleteNetworkInterface',
        'ec2:AssignPrivateIpAddresses',
        'ec2:UnassignPrivateIpAddresses',
      ],
      resources: ['*'],
    }));

    // ECR - for pulling container images
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRAuthPolicy',
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));

    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRPullPolicy',
      actions: [
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchCheckLayerAvailability',
      ],
      resources: [`arn:aws:ecr:${region}:${account}:repository/bedrock-agentcore-*`],
    }));

    //
    // EC2 Instance Role (for jump host running agentcore CLI) - kept for backward compatibility
    //
    const ec2DeploymentRole = new iam.Role(this, 'EC2DeploymentRole', {
      roleName: `AgentCoreEC2Deployment-${region}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    cdk.Tags.of(ec2DeploymentRole).add('Name', `${projectName}-ec2-deployment-role`);
    cdk.Tags.of(ec2DeploymentRole).add('Project', 'valkey-semantic-cache-demo');

    // ECR - for repository management
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRManagement',
      actions: ['ecr:*'],
      resources: [`arn:aws:ecr:${region}:${account}:repository/bedrock-agentcore-*`],
    }));

    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRGlobal',
      actions: ['ecr:GetAuthorizationToken', 'ecr:DescribeRepositories', 'ecr:CreateRepository'],
      resources: ['*'],
    }));

    // CodeBuild - for triggering builds
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CodeBuildManagement',
      actions: ['codebuild:*'],
      resources: [`arn:aws:codebuild:${region}:${account}:project/bedrock-agentcore-*`],
    }));

    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CodeBuildList',
      actions: ['codebuild:ListProjects', 'codebuild:ListBuilds'],
      resources: ['*'],
    }));

    // Bedrock - for agent management
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockAgentManagement',
      actions: ['bedrock:*'],
      resources: ['*'],
    }));

    // Bedrock AgentCore - for runtime management
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockAgentCoreManagement',
      actions: ['bedrock-agentcore:*'],
      resources: ['*'],
    }));

    // EC2 - for VPC validation during deployment
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EC2VPCValidation',
      actions: ['ec2:DescribeSubnets', 'ec2:DescribeSecurityGroups', 'ec2:DescribeVpcs'],
      resources: ['*'],
    }));

    // S3 - for uploading source code
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3SourceUpload',
      actions: [
        's3:CreateBucket',
        's3:PutObject',
        's3:GetObject',
        's3:ListBucket',
        's3:DeleteObject',
        's3:PutBucketVersioning',
        's3:PutBucketPublicAccessBlock',
        's3:PutLifecycleConfiguration',
      ],
      resources: [
        `arn:aws:s3:::bedrock-agentcore-codebuild-sources-${account}-${region}`,
        `arn:aws:s3:::bedrock-agentcore-codebuild-sources-${account}-${region}/*`,
      ],
    }));

    // IAM - for passing roles to CodeBuild and Bedrock
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'IAMPassRole',
      actions: ['iam:PassRole'],
      resources: [this.codeBuildRole.roleArn, this.runtimeRole.roleArn],
    }));

    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'IAMGetRole',
      actions: ['iam:GetRole'],
      resources: ['*'],
    }));

    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'IAMCreateServiceLinkedRole',
      actions: ['iam:CreateServiceLinkedRole'],
      resources: ['*'],
    }));

    // CloudWatch Logs - for viewing build logs
    ec2DeploymentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogsRead',
      actions: ['logs:GetLogEvents', 'logs:DescribeLogStreams', 'logs:DescribeLogGroups'],
      resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/codebuild/*`],
    }));

    // Instance profile for EC2
    new iam.CfnInstanceProfile(this, 'EC2DeploymentInstanceProfile', {
      instanceProfileName: `AgentCoreEC2Deployment-${region}`,
      roles: [ec2DeploymentRole.roleName],
    });

    //
    // NEW: CodeBuild Project for Automated AgentCore Deployment
    //
    // Additional permissions for CodeBuild role to run agentcore CLI
    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockAgentCoreManagement',
      actions: ['bedrock-agentcore:*', 'bedrock:*'],
      resources: ['*'],
    }));

    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CodeBuildNestedBuilds',
      actions: ['codebuild:*'],
      resources: [`arn:aws:codebuild:${region}:${account}:project/bedrock-agentcore-*`],
    }));

    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EC2VPCValidation',
      actions: [
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeVpcs',
        'ec2:CreateNetworkInterface',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DeleteNetworkInterface',
        'ec2:DescribeDhcpOptions',
      ],
      resources: ['*'],
    }));

    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'IAMPassRole',
      actions: ['iam:PassRole'],
      resources: [this.runtimeRole.roleArn, this.codeBuildRole.roleArn],
    }));

    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'IAMServiceLinkedRole',
      actions: ['iam:GetRole', 'iam:CreateServiceLinkedRole'],
      resources: ['*'],
    }));

    // S3 access for agent source bucket
    this.codeBuildRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3AgentSourceAccess',
      actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject', 's3:ListBucket'],
      resources: [codeBuildSourceBucket.bucketArn, `${codeBuildSourceBucket.bucketArn}/*`],
    }));

    // Import VPC and security group for CodeBuild VPC config
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId });
    const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'CacheSG', props.securityGroupId);

    // CodeBuild Project
    const deployProject = new codebuild.Project(this, 'AgentDeployProject', {
      projectName: `${projectName}-agent-deploy`,
      description: 'Deploys AgentCore agent using agentcore CLI (eliminates EC2 jump host)',
      role: this.codeBuildRole,
      timeout: cdk.Duration.minutes(30),
      source: codebuild.Source.s3({
        bucket: codeBuildSourceBucket,
        path: '/',
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          AGENT_NAME: { value: agentName },
          AWS_REGION: { value: region },
          RUNTIME_ROLE_ARN: { value: this.runtimeRole.roleArn },
          CODEBUILD_ROLE_ARN: { value: this.codeBuildRole.roleArn },
          SUBNET_IDS: { value: props.subnetIds.join(',') },
          SECURITY_GROUP_ID: { value: props.securityGroupId },
          ELASTICACHE_ENDPOINT: { value: props.elastiCacheEndpoint },
          SIMILARITY_THRESHOLD: { value: '0.80' },
          EMBEDDING_MODEL: { value: 'amazon.titan-embed-text-v2:0' },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { python: '3.12' },
            commands: [
              'echo "Installing AgentCore CLI..."',
              'pip install bedrock-agentcore-starter-toolkit',
            ],
          },
          pre_build: {
            commands: [
              'echo "Verifying environment..."',
              'agentcore --version || echo "CLI installed"',
              'cd agents',
              'ls -la',
            ],
          },
          build: {
            commands: [
              'echo "Configuring agent..."',
              'agentcore configure --entrypoint entrypoint.py --name $AGENT_NAME --execution-role $RUNTIME_ROLE_ARN --code-build-execution-role $CODEBUILD_ROLE_ARN --disable-memory --region $AWS_REGION --vpc --subnets $SUBNET_IDS --security-groups $SECURITY_GROUP_ID --non-interactive',
              'echo "Deploying agent..."',
              'agentcore deploy --env ELASTICACHE_ENDPOINT=$ELASTICACHE_ENDPOINT --env ELASTICACHE_PORT=6379 --env SIMILARITY_THRESHOLD=$SIMILARITY_THRESHOLD --env EMBEDDING_MODEL=$EMBEDDING_MODEL --env AWS_REGION=$AWS_REGION --env CLOUDWATCH_NAMESPACE=SemanticSupportDesk --auto-update-on-conflict',
            ],
          },
          post_build: {
            commands: [
              'echo "Checking agent status..."',
              'agentcore status --agent $AGENT_NAME || true',
            ],
          },
        },
      }),
      vpc,
      subnetSelection: {
        subnets: props.subnetIds.map((subnetId, index) =>
          ec2.Subnet.fromSubnetId(this, `Subnet${index}`, subnetId)
        ),
      },
      securityGroups: [securityGroup],
    });

    cdk.Tags.of(deployProject).add('Name', `${projectName}-agent-deploy`);
    cdk.Tags.of(deployProject).add('Project', 'valkey-semantic-cache-demo');

    //
    // Outputs - matching existing CF export names
    //
    new cdk.CfnOutput(this, 'CodeBuildRoleArn', {
      description: 'ARN of the CodeBuild IAM role for AgentCore',
      value: this.codeBuildRole.roleArn,
      exportName: `${this.stackName}-CodeBuildRoleArn`,
    });

    new cdk.CfnOutput(this, 'CodeBuildRoleName', {
      description: 'Name of the CodeBuild IAM role',
      value: this.codeBuildRole.roleName,
      exportName: `${this.stackName}-CodeBuildRoleName`,
    });

    new cdk.CfnOutput(this, 'RuntimeRoleArn', {
      description: 'ARN of the Runtime IAM role for deployed agent',
      value: this.runtimeRole.roleArn,
      exportName: `${this.stackName}-RuntimeRoleArn`,
    });

    new cdk.CfnOutput(this, 'RuntimeRoleName', {
      description: 'Name of the Runtime IAM role',
      value: this.runtimeRole.roleName,
      exportName: `${this.stackName}-RuntimeRoleName`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryUri', {
      description: 'URI of the ECR repository for agent container',
      value: agentECRRepository.repositoryUri,
      exportName: `${this.stackName}-ECRRepositoryUri`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryName', {
      description: 'Name of the ECR repository',
      value: agentECRRepository.repositoryName,
      exportName: `${this.stackName}-ECRRepositoryName`,
    });

    new cdk.CfnOutput(this, 'CodeBuildSourceBucketName', {
      description: 'Name of the S3 bucket for CodeBuild sources',
      value: codeBuildSourceBucket.bucketName,
      exportName: `${this.stackName}-CodeBuildSourceBucket`,
    });

    new cdk.CfnOutput(this, 'AgentDeployProjectName', {
      description: 'CodeBuild project name for automated agent deployment',
      value: deployProject.projectName,
      exportName: `${this.stackName}-AgentDeployProject`,
    });

    new cdk.CfnOutput(this, 'DeployInstructions', {
      description: 'Instructions to deploy agent',
      value: `1) Upload: cd agents && zip -r ../agent-source.zip . && aws s3 cp ../agent-source.zip s3://${codeBuildSourceBucket.bucketName}/  2) Deploy: aws codebuild start-build --project-name ${deployProject.projectName} --region ${region}`,
    });
  }
}
