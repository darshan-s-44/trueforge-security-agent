FROM alpine:3.19

RUN apk add --no-cache bash jq python3 coreutils

WORKDIR /sandbox

COPY scripts/erase.sh /usr/local/bin/erase.sh
RUN chmod +x /usr/local/bin/erase.sh

ENTRYPOINT ["/usr/local/bin/erase.sh"]
