FROM node:14

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git

# Set to a non-root built-in user `node`
USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/app

WORKDIR /home/node/app
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY --chown=node package*.json ./
COPY --chown=node yarn.lock ./

RUN yarn install

# Bundle app source code
COPY --chown=node . .

# NPM build
RUN yarn run build

# Bind to all network interfaces so that it can be mapped to the host OS
ENV HOST=0.0.0.0 PORT=22225

EXPOSE ${PORT}
CMD [ "node", "." ]