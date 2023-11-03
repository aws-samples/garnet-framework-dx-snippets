const GARNET_IOT_SQS_URL = process.env.GARNET_IOT_SQS_URL
const THING_PREFIX = process.env.THING_PREFIX

const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs")
const sqs = new SQSClient({})

exports.handler = async (event) => {
    
    try { 
        const { PayloadData, WirelessMetadata: { LoRaWAN : {FPort, DevEui, Timestamp} }} = event
        let bf = Buffer.from(PayloadData, 'base64')
        console.log(`From ${DevEui} on FPort ${FPort}: ${bf.toString('hex')}`)
        let entity_thing = {}
        let entity_airquality = {}
        let thingName 
        entity_airquality.type = `IndoorEnvironmentObserved`
        entity_airquality.id = `urn:ngsi-ld:${entity_airquality.type}:${THING_PREFIX}-${DevEui}`
        entity_thing.type = `Thing`
        entity_thing.id = `urn:ngsi-ld:${entity_thing.type}:${THING_PREFIX}-${DevEui}`
        for (let i= 0; i < bf.length; ) {
            let ch_id = bf[i]
            let ch_type = bf[i+1]
            // BATTERY
            if( ch_id == 0x01 && ch_type == 0x75 ){
                entity_thing.batteryLevel = {
                    value: (bf.subarray(2)).readUInt8(0),
                    unitCode: "P1",
                    observedAt: Timestamp
                }
                bf = bf.subarray(3)
            } 
            // TEMPERATURE
            else if (ch_id == 0x03 && ch_type == 0x67) {
                entity_airquality.temperature = {
                    value: (bf.subarray(2)).readInt16LE(0)/10,
                    unitCode: "CEL",
                    observedAt: Timestamp
                }
                bf = bf.subarray(4)
            }
            // HUMIDITY
            else if (ch_id == 0x04 && ch_type == 0x68) {
                entity_airquality.relativeHumidity = {
                    value: (bf.subarray(2)).readUInt8(0)/2,
                    unitCode: "P1",
                    observedAt: Timestamp
                }
                bf = bf.subarray(3)
            }
            // CO2
            else if (ch_id == 0x07 && ch_type == 0x7D) {
                entity_airquality.co2 = {
                    value: (bf.subarray(2)).readInt16LE(0),
                    unitCode: "59",
                    observedAt: Timestamp
                }
                bf = bf.subarray(4)
            }
            else{
                i++
            }
    
        }

        entity_airquality.dateObserved = {
            value: Timestamp
        }

        entity_airquality.refThing = {
            object: `urn:ngsi-ld:${entity_thing.type}:${THING_PREFIX}-${DevEui}`
        }

        if (!entity_airquality.temperature.value) return

        let entries = []
        entries.push({
            Id: `${Math.floor(Math.random() * 1e10)}`,
            MessageBody: JSON.stringify(entity_airquality)
        })
        entries.push({
            Id: `${Math.floor(Math.random() * 1e10)}`,
            MessageBody: JSON.stringify(entity_thing)
        })

        await sqs.send(
            new SendMessageBatchCommand({
                QueueUrl: GARNET_IOT_SQS_URL, 
                Entries: entries
            })
        )

    } 
    catch(e){
        console.log(e)
    }
}