import { Aws, Duration, Stack, StackProps } from "aws-cdk-lib";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnTopicRule } from "aws-cdk-lib/aws-iot";
import { CfnDestination } from "aws-cdk-lib/aws-iotwireless";
import { Runtime, Function, Code, Architecture, CfnPermission } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface GarnetDpAiclStackProps extends StackProps {
    garnet_iot_sqs_arn: string, 
    thing_prefix: string
  }

export class GarnetDpAiclStack extends Stack {
    constructor(scope: Construct, id: string, props: GarnetDpAiclStackProps) {
      super(scope, id, props)

      const iot_rule_name = `${props.thing_prefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}_garnet_rule`
      const garnet_iot_sqs = Queue.fromQueueArn(this, 'GarnetIotQueue', props.garnet_iot_sqs_arn)
      // LAMBDA THAT TRANSFORMS PAYLOAD INTO NGSI-LD ENTITY 
      const lambda_modeling_path  = `${__dirname}/lambda/${props.thing_prefix.split('-').slice(-1)[0].toLowerCase()}`
    
      const lambda_modeling = new Function( this, 'ModelingLambda', {
          functionName: `garnet-dp-aicl-${props.thing_prefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}-lambda`, 
          runtime: Runtime.NODEJS_18_X,
          code: Code.fromAsset(lambda_modeling_path),
          handler: 'index.handler',
          timeout: Duration.seconds(20),
          architecture: Architecture.ARM_64, 
          environment: {
              GARNET_IOT_SQS_URL : garnet_iot_sqs.queueUrl,
              THING_PREFIX: props.thing_prefix
          }
      })
  
  
      // PERMISSIONS TO PUBLISH TO THE GARNET IOT QUEUE 
      lambda_modeling.addToRolePolicy(new PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [`${garnet_iot_sqs.queueArn}`]
      })) 
  
      // IOT RULE THAT RECIVES DATA FROM LORA DESTINATION 
      const iot_rule = new CfnTopicRule(this, 'IotRule', {
        ruleName: iot_rule_name, 
        topicRulePayload: {
            awsIotSqlVersion: '2016-03-23',
            ruleDisabled: false,
            sql: `SELECT * FROM 'iot'`,
            actions: [ 
                {
                    lambda: {
                        functionArn: lambda_modeling.functionArn
                    }
                }
            ]
        }
      })
  
      // GRANT IOT RULE PERMISSION TO INVOKE MODELING LAMBDA
      new CfnPermission(this, 'LambdaPermissionIotRule', {
        principal: `iot.amazonaws.com`,
        action: 'lambda:InvokeFunction',
        functionName: lambda_modeling.functionName,
        sourceArn: `${iot_rule.attrArn}`
      })
  
      // LORA DESTINATION ROLE TO TRIGGER IoT RULE
      const role_lora_destination= new Role(this, 'RoleLoRaDestination', {
        assumedBy: new ServicePrincipal('iotwireless.amazonaws.com')
      })
  
      role_lora_destination.addToPolicy(new PolicyStatement({
        resources: ["*"],
        actions: ["iot:DescribeEndpoint"]
      }))
      role_lora_destination.addToPolicy(new PolicyStatement({
          resources: [`arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/rules/${iot_rule.ruleName}`],
          actions: ["iot:Publish"]
      }))
  
      // LORA DESTINATION
      const lora_destination = new CfnDestination(this, 'LoRaDestination', {
        expression: iot_rule_name,
        expressionType: 'RuleName',
        name: `${iot_rule_name}_destination`,
        roleArn: role_lora_destination.roleArn
      })


    }
}