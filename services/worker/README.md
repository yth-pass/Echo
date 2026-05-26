# Echo Worker (`services/worker`)



BullMQ consumers for Phase 1 async jobs. Shares Prisma schema with [`../api`](../api).



## Setup



```bash

cd services/worker

cp .env.example .env

npm install

# Generate Prisma client from API schema:

npx prisma generate --schema=../api/prisma/schema.prisma

npm run start:dev

```



Queues: `post-draft`, `moderation`, `match-daily`, `agent-turn` (must match API `QueueService` names).



## Clone runtime



Event-driven posts and match-triggered agent chat: [`docs/Clone-Runtime-and-Triggers-Echo.md`](../../docs/Clone-Runtime-and-Triggers-Echo.md).



Code: [`src/clone-runtime/`](src/clone-runtime/).



| Env | Default |

|-----|---------|

| `DEEPSEEK_API_KEY` | LLM for posts and agent turns |

| `CLONE_IDLE_POST_HOURS` | `24` — idle post trigger |



On startup the worker runs `match-daily` once, bridges pending match pushes to `agent-turn`, and runs an idle-post tick.


