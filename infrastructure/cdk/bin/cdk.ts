#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ElastiCacheStack } from '../lib/elasticache-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '507286591552',
  region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
};

// VPC configuration (using default VPC in us-east-2)
const vpcConfig = {
  vpcId: 'vpc-0f9b5afd31283e9d1',
  vpcCidrBlock: '172.31.0.0/16',
  subnetIds: [
    'subnet-0e80dd54d46959a91',
    'subnet-0257db422851c0d6b',
    'subnet-0da73b5aadcb5e744',
  ],
};

const elastiCacheStack = new ElastiCacheStack(app, 'SemanticCacheElastiCache', {
  env,
  vpcId: vpcConfig.vpcId,
  vpcCidrBlock: vpcConfig.vpcCidrBlock,
  subnetIds: vpcConfig.subnetIds,
});

app.synth();
