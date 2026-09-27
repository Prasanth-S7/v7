#!/usr/bin/env bash
set -euo pipefail

CONTAINER="broker"
BOOTSTRAP_SERVERS="localhost:9092"
PARTITIONS=1
REPLICATION_FACTOR=1

topics=(
  "create.project"
  "project.created"
  "prompt"
  "sse.event"
  "upload.project"
)

echo "Deleting existing Kafka topics..."

for topic in "${topics[@]}"; do
  echo "Deleting topic: $topic"

  docker exec "$CONTAINER" /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server "$BOOTSTRAP_SERVERS" \
    --delete \
    --topic "$topic" || true
done

echo "Waiting for Kafka to finish deleting topics..."
sleep 2

echo "Recreating Kafka topics..."

for topic in "${topics[@]}"; do
  echo "Creating topic: $topic"

  docker exec "$CONTAINER" /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server "$BOOTSTRAP_SERVERS" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION_FACTOR"
done

echo "Kafka topics have been reset successfully."