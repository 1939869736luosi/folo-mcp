import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { stringifyQuery } from 'ufo'

export async function sendApiQuery({
  args,
  path,
  method,
}: {
  args: any
  path: string
  method: string
}): Promise<CallToolResult> {
  const sessionToken = process.env.FOLO_SESSION_TOKEN
  if (!sessionToken) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Error: FOLO_SESSION_TOKEN environment variable is not set. Please provide your Folo session token to authenticate API requests.',
        },
      ],
    }
  }

  const isBodyMethod = method === 'POST' || method === 'DELETE'
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(
      `https://api.follow.is${path}${!isBodyMethod ? `?${stringifyQuery(args)}` : ''}`,
      {
        method,
        headers: {
          'cookie': `__Secure-better-auth.session_token=${sessionToken};`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          ...(isBodyMethod
            ? {
                'content-type': 'application/json',
              }
            : {}),
        },
        body: !isBodyMethod ? undefined : JSON.stringify(args),
        signal: controller.signal,
      },
    )
    clearTimeout(timeoutId)

    let json: any
    try {
      json = await res.json()
    }
    catch {
      const text = await res.text().catch(() => '')
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error: HTTP ${res.status} - ${text || res.statusText}. The API returned a non-JSON response.`,
          },
        ],
      }
    }

    // Folo 内部 API 返回 {code: 0, data: ...}，但 better-auth 等外部端点直接返回数据
    if ('code' in json && json.code !== 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error: ${json.message || 'Unknown API error'}. Code: ${json.code}.`,
          },
        ],
      }
    }

    const data = json?.data ?? json

    return {
      content: [
        {
          type: 'text',
          text: data ? JSON.stringify(data, null, 2) : 'Success',
        },
      ],
    }
  }
  catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Error: Request timed out after 30 seconds. Please check your network connection and try again.',
          },
        ],
      }
    }
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error: ${error.message || 'An unexpected error occurred'}. Please try again.`,
        },
      ],
    }
  }
}
