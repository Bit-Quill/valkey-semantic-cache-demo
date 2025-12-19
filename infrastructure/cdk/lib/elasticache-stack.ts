import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface ElastiCacheStackProps extends cdk.StackProps {
  vpcId: string;
  vpcCidrBlock: string;
  subnetIds: string[];
}

export class ElastiCacheStack extends cdk.Stack {
  public readonly securityGroup: ec2.ISecurityGroup;
  public readonly clusterEndpoint: string;

  constructor(scope: Construct, id: string, props: ElastiCacheStackProps) {
    super(scope, id, props);

    // Import existing VPC
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId });

    // Security Group - matching existing CF: semantic-cache-sg-v2
    const cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      vpc,
      securityGroupName: 'semantic-cache-sg-v2',
      description: 'Security group for ElastiCache cluster - allows Redis/Valkey traffic (port 6379) from within VPC',
      allowAllOutbound: true,
    });

    cacheSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis/Valkey traffic from VPC (Lambda functions, EC2 instances)'
    );

    cdk.Tags.of(cacheSecurityGroup).add('Name', 'semantic-cache-demo-sg');
    cdk.Tags.of(cacheSecurityGroup).add('Project', 'valkey-semantic-cache-demo');

    this.securityGroup = cacheSecurityGroup;

    // Subnet Group - matching existing CF: semantic-cache-subnet-group
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
      description: 'Subnet group for semantic caching demo ElastiCache cluster',
      subnetIds: props.subnetIds,
      cacheSubnetGroupName: 'semantic-cache-subnet-group',
      tags: [
        { key: 'Name', value: 'semantic-cache-demo-subnet-group' },
        { key: 'Project', value: 'valkey-semantic-cache-demo' },
      ],
    });

    // Parameter Group - matching existing CF
    const parameterGroup = new elasticache.CfnParameterGroup(this, 'CacheParameterGroup', {
      cacheParameterGroupFamily: 'valkey8',
      description: 'Custom parameter group for semantic cache demo with 30% memory reserve for vector search',
      properties: {
        'reserved-memory-percent': '30',
      },
      tags: [
        { key: 'Name', value: 'semantic-cache-demo-params' },
        { key: 'Project', value: 'valkey-semantic-cache-demo' },
      ],
    });

    // Replication Group - matching existing CF
    const replicationGroup = new elasticache.CfnReplicationGroup(this, 'ValkeyReplicationGroup', {
      replicationGroupDescription: 'Valkey 8.2 cluster for semantic caching demo with vector search',
      engine: 'valkey',
      engineVersion: '8.2',
      cacheNodeType: 'cache.t4g.small',
      cacheParameterGroupName: parameterGroup.ref,
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      transitEncryptionEnabled: false,
      port: 6379,
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      securityGroupIds: [cacheSecurityGroup.securityGroupId],
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      autoMinorVersionUpgrade: true,
      tags: [
        { key: 'Name', value: 'semantic-cache-demo-valkey-cluster' },
        { key: 'Project', value: 'valkey-semantic-cache-demo' },
        { key: 'Engine', value: 'valkey' },
        { key: 'Purpose', value: 'vector-search-semantic-caching' },
      ],
    });

    replicationGroup.addDependency(subnetGroup);

    this.clusterEndpoint = replicationGroup.attrPrimaryEndPointAddress;

    // Outputs - matching existing CF export names
    new cdk.CfnOutput(this, 'ReplicationGroupId', {
      description: 'Valkey replication group ID',
      value: replicationGroup.ref,
      exportName: `${this.stackName}-ReplicationGroupId`,
    });

    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      description: 'Primary endpoint address for Valkey cluster',
      value: replicationGroup.attrPrimaryEndPointAddress,
      exportName: `${this.stackName}-ClusterEndpoint`,
    });

    new cdk.CfnOutput(this, 'ClusterPort', {
      description: 'Port number for Valkey cluster',
      value: replicationGroup.attrPrimaryEndPointPort,
      exportName: `${this.stackName}-ClusterPort`,
    });

    new cdk.CfnOutput(this, 'ClusterConnectionString', {
      description: 'Full connection string for Valkey cluster (use from Lambda/VPC)',
      value: `redis://${replicationGroup.attrPrimaryEndPointAddress}:${replicationGroup.attrPrimaryEndPointPort}`,
      exportName: `${this.stackName}-ConnectionString`,
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      description: 'Security group ID for Lambda functions to use',
      value: cacheSecurityGroup.securityGroupId,
      exportName: `${this.stackName}-SecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'SubnetGroupName', {
      description: 'Subnet group name for reference',
      value: subnetGroup.ref,
      exportName: `${this.stackName}-SubnetGroupName`,
    });

    new cdk.CfnOutput(this, 'EstimatedMonthlyCost', {
      description: 'Estimated monthly cost if running 24/7 (cache.t4g.small)',
      value: '$38/month ($0.052/hour * 730 hours)',
    });
  }
}
