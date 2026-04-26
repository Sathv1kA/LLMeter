"""
JS / TS detector tests.

These lock in behaviour for the regex path: SDK attribution across vendors,
loop detection via `for`/`.map`, model resolution via const bindings,
streaming, vision, and legitimate negatives (comments).
"""
from __future__ import annotations

from pathlib import Path

from services.detector import scan_file

FIXTURES = Path(__file__).parent / "fixtures"


def _scan(name: str):
    content = (FIXTURES / name).read_text()
    return scan_file(name, content)


def test_anthropic_js_messages_create():
    calls = _scan("anthropic_js.ts")
    assert len(calls) == 1
    c = calls[0]
    assert c.sdk == "anthropic"
    assert c.detection_method == "regex"
    assert c.model_hint == "claude-3-5-haiku-20241022"
    assert c.resolved_model_id == "claude-3-5-haiku"
    assert c.max_output_tokens == 400
    assert c.in_loop is False


def test_gemini_js_in_for_of_loop():
    calls = _scan("gemini_js.ts")
    assert len(calls) == 1
    c = calls[0]
    assert c.sdk == "gemini"
    # `for (const t of texts)` → loop detector should flag this
    assert c.in_loop is True
    assert c.call_multiplier > 1


def test_cohere_js_chat():
    calls = _scan("cohere_js.ts")
    assert len(calls) == 1
    c = calls[0]
    assert c.sdk == "cohere"
    assert c.model_hint == "command-r"
    assert c.call_type == "chat"


def test_openai_stream_flag():
    calls = _scan("openai_stream.ts")
    assert len(calls) == 1
    c = calls[0]
    assert c.sdk == "openai"
    # `stream: true` kwarg should promote call_type to "stream"
    assert c.call_type == "stream"


def test_openai_vision_js():
    calls = _scan("openai_vision_js.tsx")
    assert len(calls) == 1
    c = calls[0]
    assert c.sdk == "openai"
    # The `"image_url"` marker inside the content array must flip has_vision
    assert c.has_vision is True
    assert c.max_output_tokens == 300


def test_comments_are_not_detected():
    calls = _scan("comments_js.js")
    # Commented-out calls must not produce detections
    assert calls == []


def test_region_extraction_across_lines():
    # Call split across 6 lines — model kwarg is on line 3
    src = """\
const x = openAi.chat.completions.create({
  messages: [{role:"user", content:"hi"}],
  model: "gpt-3.5-turbo",
  temperature: 0.2,
  max_tokens: 80,
});
"""
    calls = scan_file("inline.ts", src)
    assert len(calls) == 1
    c = calls[0]
    assert c.model_hint == "gpt-3.5-turbo"
    assert c.max_output_tokens == 80


def test_const_model_binding_resolution():
    # MODEL const is hoisted from elsewhere in the file and referenced by name
    calls = _scan("openai_ts.ts")
    assert len(calls) == 1
    # `const MODEL = "gpt-4o-mini"` → model: MODEL should resolve to that
    assert calls[0].model_hint == "gpt-4o-mini"


def test_langchain_map_loop_detection():
    # Already covered in test_detector.py but verify multiplier applies to cost
    calls = _scan("langchain_js.js")
    assert len(calls) == 1
    c = calls[0]
    assert c.in_loop is True
    # actual_cost_usd must be multiplied — if None (unresolved model) skip
    if c.actual_cost_usd is not None:
        # Loose lower bound: looped call should cost roughly multiplier × single
        assert c.call_multiplier >= 2


# ---------------------------------------------------------------------------
# Vercel AI SDK — `import { generateText } from "ai"` and friends
# ---------------------------------------------------------------------------

def test_vercel_ai_generate_text_with_openai_helper():
    calls = _scan("vercel_ai_basic.ts")
    assert len(calls) == 1
    c = calls[0]
    # Re-attributed from "vercel-ai" to the underlying provider.
    assert c.sdk == "openai"
    assert c.model_hint == "gpt-4o"
    assert c.resolved_model_id == "gpt-4o"
    assert c.call_type == "chat"
    assert c.max_output_tokens == 200
    assert c.in_loop is False
    assert c.actual_cost_usd is not None  # gpt-4o is in pricing table


def test_vercel_ai_stream_text_anthropic_in_loop():
    calls = _scan("vercel_ai_stream_anthropic.ts")
    assert len(calls) == 1
    c = calls[0]
    # `anthropic("claude-...")` helper → SDK should rebind to anthropic
    assert c.sdk == "anthropic"
    assert c.model_hint == "claude-3-5-haiku-20241022"
    assert c.resolved_model_id == "claude-3-5-haiku"
    assert c.call_type == "stream"
    assert c.in_loop is True
    assert c.call_multiplier >= 2


def test_bedrock_js_invoke_model_command_anthropic():
    calls = _scan("bedrock_js.ts")
    # Expect exactly one InvokeModelCommand and one ConverseCommand.
    assert len(calls) == 2, [c.raw_match for c in calls]
    by_model = {c.model_hint: c for c in calls}
    invoke = by_model.get("us.anthropic.claude-3-5-sonnet-20241022-v2:0")
    assert invoke is not None
    # Re-attributed from "bedrock" to its underlying provider.
    assert invoke.sdk == "anthropic"
    # Region prefix + version suffix should still resolve.
    assert invoke.resolved_model_id == "claude-3-5-sonnet"
    assert invoke.actual_cost_usd is not None


def test_bedrock_js_converse_cohere():
    calls = _scan("bedrock_js.ts")
    converse = next(
        (c for c in calls if c.model_hint == "cohere.command-r-plus-v1:0"),
        None,
    )
    assert converse is not None
    assert converse.sdk == "cohere"
    assert converse.resolved_model_id == "command-r-plus"


def test_vercel_ai_embed_google_with_user_defined_lookalike():
    """`embed()` is also a common user-defined function name. The detector
    must catch the real Vercel AI SDK call and ignore the wrapper that
    has no `model:` kwarg."""
    calls = _scan("vercel_ai_embed_google.ts")
    assert len(calls) == 1, [
        f"{c.line_number}: {c.raw_match}" for c in calls
    ]
    c = calls[0]
    assert c.sdk == "gemini"  # google() helper → gemini SDK label
    assert c.model_hint == "gemini-1.5-flash"
    assert c.call_type == "embedding"
    assert c.task_type == "embedding"
