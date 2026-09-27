FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
RUN pnpm install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm exec prisma generate

EXPOSE 3000

CMD ["pnpm", "run", "dev"]
