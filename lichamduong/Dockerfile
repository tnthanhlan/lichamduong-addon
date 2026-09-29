FROM node:18-alpine

RUN apk add --no-cache curl bash \
    && curl -sL -o /usr/local/bin/cloudflared \
       "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    && chmod +x /usr/local/bin/cloudflared

WORKDIR /app
COPY server ./server
COPY public ./public
COPY run.sh /run.sh
RUN chmod +x /run.sh \
    && cd server && npm install --omit=dev

ENV DATA_DIR=/data
ENV PORT=8099
EXPOSE 8099

CMD ["/run.sh"]
