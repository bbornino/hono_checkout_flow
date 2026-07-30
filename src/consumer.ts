// consumer.ts
import amqp from 'amqplib'
import { RABBITMQ_URL, ORDER_PLACED_QUEUE } from './constants.js'

async function startConsumer() {
    const connection = await amqp.connect(RABBITMQ_URL)
    const channel = await connection.createChannel()
    
    await channel.assertQueue(ORDER_PLACED_QUEUE, {durable: true})
    console.log(`👂 Listening for messages on "${ORDER_PLACED_QUEUE}"...`)

    channel.consume(ORDER_PLACED_QUEUE, (msg) => {
        if (msg) {
            const data = JSON.parse(msg.content.toString())
            console.log(`📦 New order placed: order ${data.orderId}`)
            channel.ack(msg)
        }
    })
}

startConsumer()