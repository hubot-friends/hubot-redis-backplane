import { createClient } from 'redis'
import { Outbox } from './Outbox.mjs'
import { TextMessage } from 'hubot'

const HUBOT_REDIS_INBOX_URL = process.env.HUBOT_REDIS_INBOX_URL ?? 'redis://localhost:6378'
const HUBOT_REDIS_INBOX_STREAM_NAME = process.env.HUBOT_REDIS_INBOX_STREAM_NAME ?? 'hubot-inbox'
const HUBOT_REDIS_OUTBOX_STREAM_NAME = process.env.HUBOT_REDIS_OUTBOX_STREAM_NAME ?? 'hubot-outbox'
const HUBOT_REDIS_OUTBOX_GROUP_NAME = process.env.HUBOT_REDIS_OUTBOX_GROUP_NAME ?? 'hubot-group'
const HUBOT_REDIS_OUTBOX_CONSUMER_NAME = process.env.HUBOT_REDIS_OUTBOX_CONSUMER_NAME ?? 'consumer-1'
export default async robot => {

    const client = createClient({ url: HUBOT_REDIS_INBOX_URL })
    await client.connect()

    const outbox = new Outbox(client, {
        streamName: HUBOT_REDIS_OUTBOX_STREAM_NAME,
        groupName: HUBOT_REDIS_OUTBOX_GROUP_NAME,
        consumerName: HUBOT_REDIS_OUTBOX_CONSUMER_NAME,
    })

    outbox.on('received', async entries => {
        for await (const entry of entries) {
            if (entry.message.adapter !== robot.adapter.constructor.name) continue
            let envelope = JSON.parse(entry.message.envelope)
            switch(entry.message.kind) {
                default:
                    envelope.message = new TextMessage(envelope.message.user, envelope.message.text, envelope.message.id)
                    break
            }
            try {
                await robot.adapter[entry.message.method](envelope, entry.message.strings)
            } catch (err) {
                console.warn(`Error occurred while processing message: ${err.message}. Could also be that the message came from a different chat provider than this one.`)
            }
        }
    })
    await outbox.run()

    const cleanup = async () => {
        try {
            await client.close()
            await outbox.close()
        } catch (err) {
            // ignore errors on close
        }
        process.exit()
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('uncaughtException', async err => {
        console.error('Uncaught Exception:', err)
        try {
            await client.close()
            await outbox.close()
        } catch (err) {
            // ignore errors on close
        }
        process.exit(1)
    })

    robot.listen(()=>true, {}, async resp => {
        if (resp.message.text.replace(`${robot.name} `, '').length === 0) return
        await client.xAdd(HUBOT_REDIS_INBOX_STREAM_NAME, '*', {
            kind: resp.envelope.message.constructor.name,
            recordedAt: new Date().toISOString(),
            occurredAt: new Date().toISOString(),
            id: Date.now().toString(),
            envelope: JSON.stringify(resp.envelope),
            adapter: robot.adapter.constructor.name
        })
        resp.message.finish()
    })
}