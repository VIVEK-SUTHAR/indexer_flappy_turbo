FROM oven/bun:1 AS base

WORKDIR /app

COPY package.json bun.lockb ./

RUN bun install

COPY . ./

EXPOSE 6379

EXPOSE 3000

RUN apt-get update && apt-get install -y redis-server && rm -rf /var/lib/apt/lists/*

CMD redis-server & bun run ./index.ts https://staging-rpc.dev2.eclipsenetwork.xyz 5XzgLs2Z1xtWtWSQfkJisvojk8zFnysJ62VQwYETqkxP
