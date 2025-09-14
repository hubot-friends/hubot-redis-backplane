import EventEmitter from 'node:events'

class AckResultWarning extends Error {
    constructor(ackResult) {
        super(`Acknowledgment failed with result: ${ackResult}`)
        this.name = 'AckResultWarning'
    }
}

class CreateGroupError extends Error {
    constructor(cause) {
        super(`Failed to create consumer group: ${cause}`)
        this.name = 'CreateGroupError'
    }
}

class Outbox extends EventEmitter {
    #client = null
    #isReading = false
    #readingPromise = null
    #options = null
    constructor(client, { groupName, consumerName, streamName }) {
        super()
        this.#client = client
        this.#options = { groupName, consumerName, streamName }
    }
    async #read() {
        if (!this.#client || !this.#isReading) {
            return null
        }
        let response = await this.#client.xReadGroup(this.#options.groupName, this.#options.consumerName, [
            {
                key: this.#options.streamName,
                id: '>'
            }
        ], {
            COUNT: 1,
            BLOCK: 1000
        })
        if (!response || response.length === 0) {
            return null
        }
        const ackResult = await this.#client.xAck(this.#options.streamName, this.#options.groupName, response[0].messages[0].id)
        if (ackResult != 1) {
            this.emit('warning', new AckResultWarning(ackResult))
        }

        await this.outbox(response[0].messages)
        return response
    }
    async #tryToCreateGroup(key, groupName, startFrom) {
        try {
            return await this.#client.xGroupCreate(key, groupName, startFrom, { MKSTREAM: true })
        } catch(error) {
            this.emit('info', new CreateGroupError(error))
        }
    }
    async run() {
        if (this.#client && this.#client.isConnected) {
            return
        }

        if (this.#client && !this.#client.isOpen) {
            await this.#client.connect()
        }
        await this.#tryToCreateGroup(this.#options.streamName, this.#options.groupName, '$')
        await this.#client.xTrim(this.#options.streamName, 'MAXLEN', 1000, { strategyModifier: '~' })
        this.#isReading = true
        this.#readingPromise = this.#continousRead()
        return Promise.resolve()
    }
    async close() {
        this.#isReading = false
        if (this.#readingPromise) {
            await this.#readingPromise
            this.#readingPromise = null
        }
        if (this.#client) {
            if (this.#client.isOpen) {
                await this.#client.disconnect()
            }
            this.#client = null
        }
        return Promise.resolve()
    }
    async #continousRead() {
        while(this.#isReading) {
            try {
                await this.#read()
            } catch (error) {
                if (this.#isReading) {
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }
            }
        }
    }
    async outbox(messages){
        this.emit('received', messages)
        return Promise.resolve(messages)
    }
}

export { Outbox }