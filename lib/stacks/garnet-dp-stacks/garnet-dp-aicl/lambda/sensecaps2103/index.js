const GARNET_IOT_SQS_URL = process.env.GARNET_IOT_SQS_URL
const THING_PREFIX = process.env.THING_PREFIX

const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs")
const sqs = new SQSClient({})

exports.handler = async (event) => {

    try { 
        const { PayloadData, WirelessMetadata: { LoRaWAN : {FPort, DevEui, Timestamp} }} = event
        let bf = Buffer.from(PayloadData, 'base64')
        console.log(`From ${DevEui} on FPort ${FPort}: ${bf.toString('hex')}`)
        if(bf[0] != 0x01) throw new Error(`Not a measurement data packet from ${DevEui} on FPort ${FPort}: ${bf.toString('hex')}`)
        
        let IndoorEnvironmentObserved= {
            id: `urn:ngsi-ld:IndoorEnvironmentObserved:${THING_PREFIX}-${DevEui}`,
            type: `IndoorEnvironmentObserved`
        }

        IndoorEnvironmentObserved.refThing = {
            object: `urn:ngsi-ld:Thing:${THING_PREFIX}-${DevEui}`
        }

        IndoorEnvironmentObserved.dateObserved = {
            value: Timestamp
        }

        while(bf.length > 2){
            if(bf[0] != 0x01) continue
            switch (bf.readUInt16LE(1)) {
                // CO2
                case 4100:
                    IndoorEnvironmentObserved.co2 = {
                        value: bf.readUInt32LE(3)/1000,
                        unitCode: "59",
                        observedAt: Timestamp
                    }
                    bf = bf.subarray(7)
                    break
    
                // TEMPERATURE
                case 4097:
                    IndoorEnvironmentObserved.temperature = {
                        value: bf.readUInt32LE(3)/1000,
                        unitCode: "CEL",
                        observedAt: Timestamp
                    }
                    bf = bf.subarray(7)
                    break
    
                // RELATIVE HUMIDITY
                case 4098:
                    IndoorEnvironmentObserved.relativeHumidity = {
                        value: bf.readUInt32LE(3)/1000,
                        unitCode: "P1",
                        observedAt: Timestamp
                    }
                    bf = bf.subarray(7)
                    break
                default:
                    bf = Buffer.alloc(0)
                    break
            }
       }
       
       if(!IndoorEnvironmentObserved.temperature) return

        await sqs.send(
            new SendMessageCommand({
                QueueUrl: GARNET_IOT_SQS_URL, 
                MessageBody: JSON.stringify(IndoorEnvironmentObserved)
            })
        )


    } catch(e){
        console.log(e.message)
    }
}
