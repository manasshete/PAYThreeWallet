# Pay3 API — deploy to Railway / Render / Fly
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/stellar/package.json packages/stellar/
COPY packages/recipient-resolver/package.json packages/recipient-resolver/
COPY packages/session-manager/package.json packages/session-manager/
COPY packages/policy-engine/package.json packages/policy-engine/
COPY packages/transaction-engine/package.json packages/transaction-engine/
RUN npm install --omit=dev=false

FROM deps AS build
COPY . .
RUN npm run db:generate && npm run build:api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["npm", "run", "start:api"]
