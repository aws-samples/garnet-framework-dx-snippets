import { Aws, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { athena_constant } from "../../../../constants";
import { CfnTable } from "aws-cdk-lib/aws-glue";

export interface GarnetDcAthenaStackProps extends StackProps {
    schema: Array<any>, 
    type: string,
    bucket_name: string
}

export class GarnetDcAthenaStack extends Stack {
    constructor(scope: Construct, id: string, props: GarnetDcAthenaStackProps) {
      super(scope, id, props)

      const table_name = props.type.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const glue_table = new CfnTable(this, `GarnetTable${table_name}`, {
        catalogId: Aws.ACCOUNT_ID, 
        databaseName: athena_constant.garnetAthenadatabaseName,
        tableInput: {
          name: table_name,
          tableType: `EXTERNAL_TABLE`, 
          parameters: {
            classification: "json",
            "projection.enabled" : "true",
            "projection.dt.type" : "date",
            "projection.dt.format" : "yyyy-MM-dd-HH",
            "projection.dt.range" : "2023-01-01-00,NOW",
            "projection.dt.interval" : "1",
            "projection.dt.interval.unit" : "HOURS",
            "projection.type.type" : "enum",
            "projection.type.values" : `${props.type}`,
            
          },
          storageDescriptor: {
              location: `s3://${props.bucket_name}/`, 
              inputFormat: `org.apache.hadoop.mapred.TextInputFormat`,
              outputFormat: `org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat`,
              serdeInfo: {
                  serializationLibrary: `org.openx.data.jsonserde.JsonSerDe`
              },
              columns: props.schema
          },
          partitionKeys: [
            {
              name: "type",
              type: "string"
            },
            {
              name: "dt",
              type: "string"
            }
          ]
        }
  
      })
    }
}