#!/usr/bin/env node
import 'source-map-support/register'

import { GarnetDxExamplesStack } from '../lib/garnet-dx-examples-stack'
import { App, Aws } from 'aws-cdk-lib'
import { Parameters } from '../parameters'
import { GarnetDpAiclStack } from '../lib/stacks/garnet-dp-stacks/garnet-dp-aicl/garnet-dp-aicl'
import { GarnetDcAthenaStack } from '../lib/stacks/garnet-dc-stacks/garnet-dc-athena/garnet-dc-athena'
import { IndoorEnvironmentObserved } from '../athena-schema'

const app = new App()
const env = {
  region: Parameters.aws_region
}

// ARN OF THE GARNET IOT QUEUE. IF YOU KEPT THE DEFAULT NAME, YOU DON'T NEED TO CHANGE IT 
const garnet_iot_sqs_arn = `arn:aws:sqs:${Aws.REGION}:${Aws.ACCOUNT_ID}:garnet-iot-queue-${Aws.REGION}`
const bucket_name = `garnet-datalake-${Aws.REGION}-${Aws.ACCOUNT_ID}`

// EXAMPLES OF DATA PRODUCERS AND DATA CONSUMERS STACKS 


// DATA PRODUCERS


// DATA PRODUCER USING AWS IOT CORE FOR LORAWAN 

/**
 * You can deploy same stack multiple times for distinct sensors. 
 * We include samples of payload decoders (Lambda Function) for various sensors and applications.
 * 
 * The name of the decoding function to use is extracted from the thing_prefix used. 
 * For example, if you use the prefix IndoorEnvironment-AM103, 
 * the stack will extract the last part of the prefix in lower case am103 and 
 * will use the Lambda in the folder with the same name am103
 */

new GarnetDpAiclStack(app, 'GarnetDpAiclAM103', {
  env,
  stackName: `Garnet-DP-AICL-AM103`, 
  thing_prefix: 'IndoorEnvironment-AM103', 
  garnet_iot_sqs_arn
})

new GarnetDpAiclStack(app, 'GarnetDpAiclErsSound', {
  env,
  stackName: `Garnet-DP-AICL-ErsSound`, 
  thing_prefix: 'IndoorEnvironment-ErsSound', 
  garnet_iot_sqs_arn
})

// DATA CONSUMERS 

// DATA CONSUMER USING ATHENA TO QUERY THE GARNET DATALAKE 

/**
 * Below is an example of a stack creating a table to query data from the 
 * garnet datalake using the Smart Data Model IndoorEnvironmentObserved.
 * You can add or change the schema defining the model in the file schema.ts
 */

new GarnetDcAthenaStack(app, 'GarnetAthenaTableIndoorEnvObserved', {
  schema: IndoorEnvironmentObserved, 
  type: 'IndoorEnvironmentObserved',
  bucket_name: bucket_name 
})