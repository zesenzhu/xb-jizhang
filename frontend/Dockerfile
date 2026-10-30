FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
RUN pnpm config set minimum-release-age 0
RUN printf 'dangerouslyAllowAllBuilds: true\nnodeLinker: hoisted\n' > pnpm-workspace.yaml
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
RUN pnpm config set minimum-release-age 0
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY package.json pnpm-lock.yaml ./
COPY . .
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8090
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 8090
CMD ["node", "server.js"]
