// import { createKafkaClient } from "@v7/kafka";
// import { Topics } from "@v7/kafka/topics";
// import type { EachMessagePayload } from "kafkajs";
// import { mkdir, rm, writeFile } from "fs/promises";
// import path from "path";
// import {
//     S3Client,
//     ListObjectsV2Command,
//     GetObjectCommand,
// } from "@aws-sdk/client-s3";
// import { env } from "@v7/env/shared";
// import { getProjectDir } from "@v7/env/sharedDir";

// const kafka = createKafkaClient("workspace-service");

// const consumer = kafka.consumer({
//     groupId: "workspace-service-group",
// });

// const producer = kafka.producer();

// await producer.connect();
// await consumer.connect();

// await consumer.subscribe({
//     topic: Topics.CREATE_PROJECT,
// });