FROM mwaeckerlin/nodejs-build AS modules
ADD --chown=${BUILD_USER} package.json package.json
ADD --chown=${BUILD_USER} package-lock.json package-lock.json
RUN NODE_ENV=production npm install

FROM modules AS build
RUN NODE_ENV=development npm install
ADD --chown=${BUILD_USER} . .
RUN NODE_ENV=production npm run build

FROM mwaeckerlin/nodejs AS production
EXPOSE 4000
ENV MCP_GITHUB_HOST=0.0.0.0
ENV MCP_GITHUB_PORT=4000
ENV NODE_OPTIONS=--use-bundled-ca
COPY --from=build /app/dist /app/dist
COPY --from=modules /app/node_modules node_modules
COPY --from=build /app/SKILL.md /app/skills/mcp-github/SKILL.md
HEALTHCHECK --interval=5s --timeout=30s --start-period=10s --retries=60 \
  CMD node -e "fetch('http://127.0.0.1:4000/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["dist/server.js"]

FROM production