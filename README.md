# Hubot Redis Backplane

**hubot-redis-backplane** leverages [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) to create a distributed backplane for Hubot.

## Hubot Consumer

This module is a [Hubot Adapter](https://hubotio.github.io/hubot/adapters.html). If you npm install it, you would start a Hubot instance with `-a @hubot-friends/hubot-redis-backplane` and it will connect to Redis, create a Consumer Group and register itself as a Consumer to the specified Redis Stream (e.g. **inbox**) and "listen" for incoming messages. The term "Adapter" here is just the fact that this connection utlizes Hubot's Adapter design – technically speaking. So in this part of the setup, Redis Streams is the message input and the Hubot Consumer connects to a stream as it's source of messages.

At this point, it does nothing until messages are added to the **inbox** stream. **Note. You could add messages manually via the Redis CLI if you wanted and the Hubot Consumer would process those messages and add it's response to a Redis Stream – outbox.** Referring to the right side of the diagram below, we've started a Hubot Consumer # 1, part of a Redis Consumer Group. There can be multiple Consumer Groups. I think of a Consumer Group as providing a set of functionality. You'll typlically just have a single Consumer Group where all the Hubot Consumers come from a single codebase, but have different "consumer ids". I'm sure we could go crazy here with scaling functionality out with multiple Consumer Groups. But let's try to keep things simple first before we jump to ***Hyperspace***.

![Architecture](image-1.png)

## Hubot Adapter (Adapter here refers to the adapter that connects to the chat app e.g. Discord, Slack, MS Teams)

The next part of the design is the left side of the diagram above – the input.

This Hubot instance's role is the adapter to the chat platoform (e.g. Slack, MS Teams, Discord). You'll still start this instance with something like `hubot -a @hubot-friends/hubot-discord` because the chat platform is how users interact with Hubot – the input. But now, this Hubot instance won't have all you're command handling scripts; it'll have the [inbox Hubot script](inbox.mjs) located in this package.

The steps to manually install this script is:

- `npm i @hubot-friends/hubot-redis-backplane`
- Add `hubot-redis-backplane/inbox.mjs` to your `external-scripts.json` file

    ```json
    [
        "hubot-redis-backplane/inbox.mjs"
    ]
    ```

If you want to start from scratch:

- `cd folder-to-have-mybot` Probably use a different folder name
- `npx hubot --create myhubot --adapter @hubot-friends/hubot-discord` Pick your adapter. Just using Discord as an example here.
- `cd myhubot`
- `npm i @hubot-friends/hubot-redis-backplane`
- Add `hubot-redis-backplane/inbox.mjs` to your `external-scripts.json` file

    ```json
    [
        "hubot-redis-backplane/inbox.mjs"
    ]
    ```

Now when you start the Hubot Adapter instance as shown in the diagram above, incoming chat messages will be pushed into a Redis **inbox** stream, Hubot Redis Consumers get and process these messages, and responses are written back to an **outbox** Redis stream for delivery back to the chat. This lets you scale Hubot horizontally across processes or servers while keeping the UX seamless.

Don't forget, you need a Redis server.

# How do I start a Hubot consumer?

My assumption is that this is a Git repo that contains all of your Hubot scripts (i.e. in a folder called scripts).

```sh
HUBOT_REDIS_URL=redis://localhost:6378 HUBOT_CONSUMER_GROUP_NAME=hubot-group HUBOT_INBOX_STREAM_NAME=hubot-inbox HUBOT_OUTBOX_STREAM_NAME=hubot-outbox HUBOT_CONSUMER_NAME=hubot-consumer-1 npm start -- --name ${NAME_OF_YOUR_HUBOT}
```

`NAME_OF_YOUR_HUBOT` is the name you gave your Hubot instance that is connected to the chat app.

Say you're building a Discord bot with Hubot. You have a start task in your `package.json` file like so:

```json
{
    "scripts": {
        "start": "hubot --adapter hubot-friends/hubot-discord"
    }
}
```

Starting the instance with: 

```sh
HUBOT_REDIS_URL=redis://localhost:6378 HUBOT_CONSUMER_GROUP_NAME=hubot-group HUBOT_INBOX_STREAM_NAME=hubot-inbox HUBOT_OUTBOX_STREAM_NAME=hubot-outbox HUBOT_CONSUMER_NAME=hubot-consumer-1 npm start -- --name ${NAME_OF_YOUR_HUBOT}
```

sets the name of your Hubot. So when you're on Discord and you want to send your Hubot a message, you'd do it like (where name is **mybot** in this example), `@mybot help`.

You might have the name set in the start script like so:

```json
{
    "scripts": {
        "start": "hubot --adapter hubot-friends/hubot-discord --name mybot"
    }
}
```

In which case, you wouldn't need to include the `-- --name ${NAME_OF_YOUR_HUBOT}` becasue it's already set in the start task.


# What are the required environment variables?

- `HUBOT_REDIS_INBOX_URL` (default: `redis://localhost:6378`)
- `HUBOT_REDIS_INBOX_STREAM_NAME` (default: `hubot-inbox`)
- `HUBOT_REDIS_OUTBOX_STREAM_NAME` (default: `hubot-outbox`)
- `HUBOT_REDIS_OUTBOX_GROUP_NAME` (default: `hubot-group`)
- `HUBOT_REDIS_OUTBOX_CONSUMER_NAME` (default: `consumer-1`)

Where each consumer instance has a unique value for it's consumer name.