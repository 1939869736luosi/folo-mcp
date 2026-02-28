# folo-mcp

MCP server for [Folo](https://folo.is) (RSS reader) — 12 tools for managing entries, subscriptions, collections, feeds and user profile.

Based on [hyoban/folo-mcp](https://github.com/hyoban/folo-mcp), extended with 7 additional tools, MCP spec compliance (annotations, detailed descriptions, isError handling), and robustness improvements (30s timeout, non-JSON response handling).

## Tools

| Tool | Description | Type |
|------|------------|------|
| `entry_list` | Get a list of entries (articles) | Read |
| `get_entry` | Get full content of a specific entry | Read |
| `subscription_list` | List RSS subscriptions | Read |
| `unread_count` | Get unread count grouped by feed | Read |
| `feed_info` | Get feed info by ID or URL | Read |
| `discover_feed` | Discover RSS feeds by keyword or URL | Read |
| `get_profile` | Get user profile and subscription limits | Read |
| `mark_read` | Mark entries as read | Write |
| `star_entry` | Star (collect) an entry | Write |
| `unstar_entry` | Unstar (remove from collection) | Write |
| `subscribe` | Subscribe to a new RSS feed | Write |
| `unsubscribe` | Unsubscribe from a feed | Write |

## Setup

### 1. Get your session token

1. Open [app.folo.is](https://app.folo.is) in Chrome
2. Open DevTools → Application → Cookies
3. Copy the value of `__Secure-better-auth.session_token`

> **Note**: Session tokens expire periodically (typically 7-30 days). You'll need to refresh when API calls return auth errors.

### 2. Configure MCP

Add to your MCP client config:

```json
{
  "mcpServers": {
    "folo-mcp": {
      "command": "npx",
      "args": ["-y", "github:1939869736luosi/folo-mcp"],
      "env": {
        "FOLO_SESSION_TOKEN": "<your-token-here>"
      }
    }
  }
}
```

## License

MIT — see [LICENSE.md](LICENSE.md)

Original work by [Stephen Zhou (hyoban)](https://github.com/hyoban). Extended by [1939869736luosi](https://github.com/1939869736luosi).
