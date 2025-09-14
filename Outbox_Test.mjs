import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from 'redis'
import { Outbox } from './Outbox.mjs'

const REDIS_URL = 'redis://localhost:6378'
const OUTBOX_STREAM_NAME = 'hubot-outbox'

await test('Outbox', async t => {
    await t.test('Reads from outbox', async () => {
        const client = createClient({
            url: REDIS_URL
        })
        const sut = new Outbox(client, {
            groupName: 'test-group',
            consumerName: 'test-consumer',
            streamName: OUTBOX_STREAM_NAME
        })

        const messageWasReceived = new Promise(resolve => {
            sut.on('received', async entries => {
                resolve(true)
            })
        })

        await sut.run()

        await client.xAdd(OUTBOX_STREAM_NAME, '*', {
            kind: 'TextMessage',
            recordedAt: new Date().toISOString(),
            occurredAt: new Date().toISOString(),
            id: Date.now().toString(),
            envelope: JSON.stringify({
                user: 'user1',
                room: 'general',
                text: '@t-bot hey i expect a reply yo',
                message: {user: 'user1', room: 'general', text: '@t-bot hey i expect a reply yo', id: Date.now()}
            })
        })
        await sut.close()
        await Promise.race([
            messageWasReceived,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Reply timeout')), 3000)
            )
        ])

        assert.ok(messageWasReceived, 'Reply should have been sent')
    })
})
