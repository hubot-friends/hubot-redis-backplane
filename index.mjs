import { RedisConsumerAdapter } from './RedisConsumerAdapter.mjs'
import { createClient } from 'redis'

const HUBOT_REDIS_URL = process.env.HUBOT_REDIS_URL ?? 'redis://localhost:6378'
const HUBOT_CONSUMER_GROUP_NAME = process.env.HUBOT_CONSUMER_GROUP_NAME ?? 'hubot-group'
const HUBOT_CONSUMER_NAME = process.env.HUBOT_CONSUMER_NAME ?? 'hubot-consumer-1'
const HUBOT_INBOX_STREAM_NAME = process.env.HUBOT_INBOX_STREAM_NAME ?? 'hubot-inbox'
const HUBOT_OUTBOX_STREAM_NAME = process.env.HUBOT_OUTBOX_STREAM_NAME ?? 'hubot-outbox'

export default {
    async use(robot) {
        const client = createClient({
            url: HUBOT_REDIS_URL
        })
        const consumer = new RedisConsumerAdapter(robot, client, {
            streamName: HUBOT_INBOX_STREAM_NAME,
            outboxStreamName: HUBOT_OUTBOX_STREAM_NAME,
            groupName: HUBOT_CONSUMER_GROUP_NAME,
            consumerName: HUBOT_CONSUMER_NAME
        })

        const cleanup = async () => {
            try {
                await client.close()
                await consumer.close()
            } catch (err) {
                // ignore errors on close
            }
            process.exit()
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)
        process.on('uncaughtException', async err => {
            console.error('Uncaught exception:', err)
            try {
                await client.close()
                await consumer.close()
            } catch (err) {
                // ignore errors on close
            }
            process.exit(1)
        })

        return consumer
    }
}