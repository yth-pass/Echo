# DashScope Wan2.7-Image-Pro API Reference

## Endpoints

| Operation | Method | URL |
|-----------|--------|-----|
| Create task (domestic) | POST | `https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation` |
| Create task (international) | POST | `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/image-generation/generation` |
| Poll task | GET | `https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}` |

## Create Task Request

### Headers

```
Authorization: Bearer <DASHSCOPE_API_KEY>
X-DashScope-Async: enable
Content-Type: application/json
```

### Body (text-to-image)

```json
{
  "model": "wan2.7-image-pro",
  "input": {
    "messages": [
      {
        "role": "user",
        "content": [{"text": "your prompt here"}]
      }
    ]
  },
  "parameters": {
    "n": 1,
    "size": "2K",
    "watermark": false,
    "thinking_mode": true
  }
}
```

### Body (image-to-image)

Add `{"image": "<url>"}` entries to the content array:

```json
"content": [
  {"text": "edit instruction"},
  {"image": "https://example.com/ref1.jpg"},
  {"image": "https://example.com/ref2.jpg"}
]
```

### Parameters

| Param | Values | Default | Notes |
|-------|--------|---------|-------|
| `model` | `wan2.7-image-pro`, `wan2.7-image` | — | Pro supports 4K |
| `size` | `1K`(1024px), `2K`(2048px), `4K`(4096px) | `2K` | 4K only for text-to-image on Pro |
| `n` | 1-4 (normal), 1-12 (sequential mode) | 1 | |
| `thinking_mode` | `true`/`false` | — | Enable for higher quality (slower) |
| `watermark` | `true`/`false` | — | Add Qwen watermark |

### Image Input Constraints

- Formats: JPEG, JPG, PNG, BMP, WEBP (no alpha channel)
- Resolution: 240-8000px per side, aspect ratio [1:8, 8:1]
- Size: max 20 MB per image
- Quantity: 0-9 images per request

## Create Task Response

```json
{
  "request_id": "xxx",
  "output": {
    "task_id": "59fb4786-...",
    "task_status": "PENDING"
  }
}
```

## Poll Task Response (SUCCEEDED)

### Format A — choices (Wan2.7 messages format)

```json
{
  "output": {
    "task_id": "59fb4786-...",
    "task_status": "SUCCEEDED",
    "choices": [
      {
        "finish_reason": "stop",
        "message": {
          "role": "assistant",
          "content": [{"image": "https://oss-url/0.png", "type": "image"}]
        }
      }
    ]
  },
  "usage": {"size": "1024*1024", "image_count": 1, "total_tokens": 36}
}
```

### Format B — results (legacy)

```json
{
  "output": {
    "task_status": "SUCCEEDED",
    "results": [{"url": "https://oss-url/0.png"}]
  }
}
```

## Poll Task Response (FAILED)

```json
{
  "output": {
    "task_status": "FAILED",
    "message": "Error description"
  }
}
```

## Image Download

OSS signed URLs are returned. Download immediately — URLs expire after `Expires` timestamp in query params (usually ~30 days). Content-Type reflects image format.
