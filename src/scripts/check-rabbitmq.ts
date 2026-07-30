import 'dotenv/config'
import amqp from 'amqplib'

async function checkRabbitMQ() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL!)
        console.log('✅ RabbitMQ is reachable.\n')
        await connection.close()
        process.exit(0)
    } catch {
        console.error('\n❌ RabbitMQ isn\'t reachable.')
        console.error('    Check that the rabbitmq-hono Docker container is running: docker ps\n')
        process.exit(1)
    }
}

checkRabbitMQ()