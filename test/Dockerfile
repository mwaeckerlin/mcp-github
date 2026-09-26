FROM mwaeckerlin/nodejs-build AS modules
ADD --chown=${BUILD_USER} package.json package.json
ADD --chown=${BUILD_USER} package-lock.json package-lock.json
RUN --mount=type=cache,target=/home/coder/.npm,uid=101,gid=1001 NODE_ENV=production npm install

FROM mwaeckerlin/nodejs
COPY --from=modules /app/node_modules node_modules
COPY test/e2e.mjs test/e2e-auth.mjs ./

CMD ["e2e.mjs"]
