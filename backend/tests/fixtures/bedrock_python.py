"""Fixture: AWS Bedrock direct invocation via boto3."""
import json
import boto3

bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")

def summarize(text: str) -> str:
    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-5-haiku-20241022-v1:0",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "messages": [
                {"role": "user", "content": f"Summarize: {text}"},
            ],
        }),
    )
    return json.loads(response["body"].read())["content"][0]["text"]


def stream_completion(prompt: str):
    return bedrock.invoke_model_with_response_stream(
        modelId="meta.llama3-70b-instruct-v1:0",
        body=json.dumps({"prompt": prompt, "max_gen_len": 800}),
    )
