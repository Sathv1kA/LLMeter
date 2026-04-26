// Fixture: AWS Bedrock invoke via Node SDK + Converse API
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

export async function summarize(text: string) {
  const cmd = new InvokeModelCommand({
    modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    contentType: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 200,
      messages: [{ role: "user", content: `Summarize: ${text}` }],
    }),
  });
  const out = await client.send(cmd);
  return out;
}

export async function classify(text: string) {
  const cmd = new ConverseCommand({
    modelId: "cohere.command-r-plus-v1:0",
    messages: [{ role: "user", content: [{ text: `Classify intent: ${text}` }] }],
  });
  return client.send(cmd);
}
