const GARNET_IOT_SQS_URL = process.env.GARNET_IOT_SQS_URL
const THING_PREFIX = process.env.THING_PREFIX

const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs")
const sqs = new SQSClient({})

exports.handler = async (event) => {
    try { 
        const { PayloadData, WirelessMetadata: { LoRaWAN : {FPort, DevEui, Timestamp} }} = event
        let bf = Buffer.from(PayloadData, 'base64')
        console.log(`From ${DevEui} on FPort ${FPort}: ${bf.toString('hex')}`)
        if (bf[0] == 0x3e) {
            throw new Error('Setting data')
        }

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

        for (let i=0; i < bf.length;){
                let type = bf[i]
                // TEMPERATURE
                if(type == 0x01){
                    IndoorEnvironmentObserved.temperature = {
                        value: (bf.subarray(1)).readInt16BE(0)/10,
                        unitCode: "CEL",
                        observedAt: Timestamp
                    }
                bf = bf.subarray(3)
                } 
                // HUMIDITY
                else if(type == 0x02){
                    IndoorEnvironmentObserved.relativeHumidity = {
                        value: (bf.subarray(1)).readUInt8(0),
                        unitCode: "P1",
                        observedAt: Timestamp
                    }
                bf = bf.subarray(2)
                } 
                // LIGHT
                else if(type == 0x04){
                    IndoorEnvironmentObserved.illuminance = {
                        value: (bf.subarray(1)).readInt16BE(0),
                        unitCode: "LUX",
                        observedAt: Timestamp
                    }
                    bf = bf.subarray(3)
                } 
                // PIR
                else if(type == 0x05){
                    // IndoorEnvironmentObserved.peopleCount = {
                    //     value: (bf.subarray(1)).readUInt8(0)
                    // }
                    bf = bf.subarray(2)
                }
                // Internal Battery Voltage
                else if(type == 0x07){
                    const voltage = (bf.subarray(1)).readInt16BE(0) / 1000
                    console.log({voltage})
                    bf = bf.subarray(3)
                } 
                // SOUND
                else if(type == 0x15){
                    IndoorEnvironmentObserved.LAmax = {
                        value: (bf.subarray(1)).readUInt8(0),
                        unitCode: "dB"
                    }
                    IndoorEnvironmentObserved.LAeq = {
                        value: (bf.subarray(2)).readUInt8(0),
                        unitCode: "dB"
                    }
                    bf = bf.subarray(3)
                } 
                else {
                    i++
                }
            }

        await sqs.send(
            new SendMessageCommand({
                QueueUrl: GARNET_IOT_SQS_URL, 
                MessageBody: JSON.stringify(IndoorEnvironmentObserved)
            })
        )

    } 
    catch(e){
        console.log(e)
    }
}