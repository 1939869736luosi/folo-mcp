#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { stringifyQuery } from 'ufo';
import { z } from 'zod';

async function sendApiQuery({ args, path, method }) {
    const sessionToken = process.env.FOLO_SESSION_TOKEN;
    if (!sessionToken) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: 'Error: FOLO_SESSION_TOKEN environment variable is not set. Please provide your Folo session token to authenticate API requests.'
                }
            ]
        };
    }
    const isBodyMethod = method === 'POST' || method === 'DELETE';
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), 30000);
    try {
        const res = await fetch(`https://api.follow.is${path}${!isBodyMethod ? `?${stringifyQuery(args)}` : ''}`, {
            method,
            headers: {
                'cookie': `__Secure-better-auth.session_token=${sessionToken};`,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                ...isBodyMethod ? {
                    'content-type': 'application/json'
                } : {}
            },
            body: !isBodyMethod ? undefined : JSON.stringify(args),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        let json;
        try {
            json = await res.json();
        } catch  {
            const text = await res.text().catch(()=>'');
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: `Error: HTTP ${res.status} - ${text || res.statusText}. The API returned a non-JSON response.`
                    }
                ]
            };
        }
        // Folo 内部 API 返回 {code: 0, data: ...}，但 better-auth 等外部端点直接返回数据
        if ('code' in json && json.code !== 0) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: `Error: ${json.message || 'Unknown API error'}. Code: ${json.code}.`
                    }
                ]
            };
        }
        const data = json?.data ?? json;
        return {
            content: [
                {
                    type: 'text',
                    text: data ? JSON.stringify(data, null, 2) : 'Success'
                }
            ]
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: 'Error: Request timed out after 30 seconds. Please check your network connection and try again.'
                    }
                ]
            };
        }
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message || 'An unexpected error occurred'}. Please try again.`
                }
            ]
        };
    }
}

const zodView = z.number().optional().describe('Filter by view type, 0 for Articles, 1 for Social Media, 2 for Pictures, 3 for Videos, 4 for Audios, 5 for Notifications');
const zodUserId = z.string().optional().describe('Filter by user ID, if not provided, the current user will be used');
const zodFeedId = z.string().optional().describe('Filter by feed ID');
const zodListId = z.string().optional().describe('Filter by list ID');
const zodFeedIdList = z.array(z.string()).optional().describe('Filter by list of feed IDs');
const zodInboxId = z.string().optional().describe('Filter by inbox ID');
const tools = {
    entry_list: {
        name: 'entry_list',
        description: `Get a list of entries (articles) from Folo.

Args:
  - view (number, optional): View type filter (0=Articles, 1=Social, 2=Pictures, 3=Videos, 4=Audios, 5=Notifications)
  - feedId (string, optional): Filter by specific feed ID
  - listId (string, optional): Filter by list ID
  - feedIdList (string[], optional): Filter by multiple feed IDs
  - read (boolean, optional): Filter by read status (true=read, false=unread)
  - limit (number, optional): Max entries to return
  - publishedAfter (string, optional): ISO datetime, only entries after this date
  - publishedBefore (string, optional): ISO datetime, only entries before this date
  - isCollection (boolean, optional): Set true to get starred/collected entries only
  - withContent (boolean, optional): Include full content in response

Returns: Array of entry objects with entries, feeds, and read status metadata.

Examples:
  - Get unread articles: {view: 0, read: false, limit: 10}
  - Get starred entries: {isCollection: true}
  - Get entries with full content: {feedId: "xxx", withContent: true}`,
        query: {
            path: '/entries',
            method: 'POST'
        },
        input: {
            view: zodView,
            feedId: zodFeedId,
            listId: zodListId,
            feedIdList: zodFeedIdList,
            read: z.boolean().optional().describe('Filter by read status'),
            limit: z.number().optional().describe('Limit the number of entries returned'),
            publishedAfter: z.string().datetime().optional().describe('Filter by published date after this date'),
            publishedBefore: z.string().datetime().optional().describe('Filter by published date before this date'),
            isCollection: z.boolean().optional().describe('Filter by collection status, set true for Starred'),
            withContent: z.boolean().optional().describe('Include content in the response')
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    subscription_list: {
        name: 'subscription_list',
        description: `Get a list of RSS subscriptions from Folo.

Args:
  - view (number, optional): View type filter (0=Articles, 1=Social, 2=Pictures, 3=Videos, 4=Audios, 5=Notifications)
  - userId (string, optional): User ID, defaults to current user

Returns: Array of subscription objects with feed details, categories, and view settings.

Examples:
  - List all subscriptions: {}
  - List article subscriptions: {view: 0}`,
        query: {
            path: '/subscriptions',
            method: 'GET'
        },
        input: {
            view: zodView,
            userId: zodUserId
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    unread_count: {
        name: 'unread_count',
        description: `Get the unread count from Folo grouped by feed.

Args:
  - view (number, optional): View type filter

Returns: Object with feed IDs as keys and unread counts as values.

Examples:
  - Get all unread counts: {}
  - Get article unread counts: {view: 0}`,
        query: {
            path: '/reads',
            method: 'GET'
        },
        input: {
            view: zodView
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    feed_info: {
        name: 'feed_info',
        description: `Get information about a specific RSS feed by ID or URL.

Args:
  - id (string, optional): Feed ID (Snowflake ID format)
  - url (string, optional): Feed URL

Returns: Feed object with title, description, URL, and subscriber count.

Examples:
  - Get feed by ID: {id: "41459996870678529"}
  - Get feed by URL: {url: "https://example.com/feed.xml"}`,
        query: {
            path: '/feeds',
            method: 'GET'
        },
        input: {
            id: z.string().optional().describe('Feed ID'),
            url: z.string().url().optional().describe('Feed URL')
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    mark_read: {
        name: 'mark_read',
        description: `Mark entries as read in Folo. Can mark by view, feed, list, inbox, or specific feed IDs.

Args:
  - view (number, optional): Mark all entries of this view type as read
  - feedId (string, optional): Mark entries of this feed as read
  - listId (string, optional): Mark entries of this list as read
  - inboxId (string, optional): Mark entries of this inbox as read
  - feedIdList (string[], optional): Mark entries of these feeds as read
  - startTime (number, optional): Only mark entries after this timestamp
  - endTime (number, optional): Only mark entries before this timestamp

Returns: Success confirmation.

Examples:
  - Mark all articles read: {view: 0}
  - Mark a feed read: {feedId: "41459996870678529"}`,
        query: {
            path: '/reads/all',
            method: 'POST'
        },
        input: {
            view: zodView,
            feedId: zodFeedId,
            listId: zodListId,
            inboxId: zodInboxId,
            feedIdList: zodFeedIdList,
            startTime: z.number().optional().describe('Only mark entries after this timestamp'),
            endTime: z.number().optional().describe('Only mark entries before this timestamp')
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    star_entry: {
        name: 'star_entry',
        description: `Star (collect/favorite) an entry in Folo. Adds the entry to the user's starred collection.

Args:
  - entryId (string, required): The Snowflake ID of the entry to star

Returns: Success confirmation.

Examples:
  - Star an entry: {entryId: "250437246561288192"}`,
        query: {
            path: '/collections',
            method: 'POST'
        },
        input: {
            entryId: z.string().describe('The ID of the entry to star')
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    unstar_entry: {
        name: 'unstar_entry',
        description: `Unstar (remove from collection) an entry in Folo. Removes the entry from the user's starred collection.

Args:
  - entryId (string, required): The Snowflake ID of the entry to unstar

Returns: Success confirmation.

Examples:
  - Unstar an entry: {entryId: "250437246561288192"}`,
        query: {
            path: '/collections',
            method: 'DELETE'
        },
        input: {
            entryId: z.string().describe('The ID of the entry to unstar')
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    subscribe: {
        name: 'subscribe',
        description: `Subscribe to a new RSS feed in Folo by URL. This will add the feed to the user's subscription list.

Args:
  - url (string, required): The RSS feed URL to subscribe to
  - view (number, optional): View type (0=Articles, 1=Social, etc.)
  - title (string, optional): Custom display title for the subscription
  - category (string, optional): Category to place the subscription in
  - isPrivate (boolean, optional): Whether the subscription is private

Returns: Subscription confirmation with feed details.

Examples:
  - Subscribe to a feed: {url: "https://example.com/feed.xml"}
  - Subscribe with custom title: {url: "https://example.com/feed.xml", title: "My Feed", view: 0}`,
        query: {
            path: '/subscriptions',
            method: 'POST'
        },
        input: {
            url: z.string().url().describe('The RSS feed URL to subscribe to'),
            view: zodView,
            title: z.string().optional().describe('Custom title for the subscription'),
            category: z.string().optional().describe('Category to place the subscription in'),
            isPrivate: z.boolean().optional().describe('Whether the subscription is private')
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true
        }
    },
    unsubscribe: {
        name: 'unsubscribe',
        description: `Unsubscribe from a feed in Folo. This permanently removes the feed from the user's subscription list.

Args:
  - feedId (string, required): The feed ID to unsubscribe from

Returns: Success confirmation.

Examples:
  - Unsubscribe: {feedId: "41459996870678529"}`,
        query: {
            path: '/subscriptions',
            method: 'DELETE'
        },
        input: {
            feedId: z.string().describe('The feed ID to unsubscribe from')
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    get_entry: {
        name: 'get_entry',
        description: `Get the full content of a specific entry by its ID.

Args:
  - id (string, required): The entry ID (Snowflake ID format) to retrieve

Returns: Entry object with full content, title, author, published date, and associated feed info.

Examples:
  - Get entry details: {id: "250437246561288192"}`,
        query: {
            path: '/entries',
            method: 'GET'
        },
        input: {
            id: z.string().describe('The entry ID to retrieve')
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    discover_feed: {
        name: 'discover_feed',
        description: `Discover RSS feeds by keyword or URL. Use this to find new feeds to subscribe to.

Args:
  - keyword (string, optional): Keyword to search for feeds (e.g., "technology", "AI")
  - url (string, optional): URL to discover RSS feeds from (e.g., a blog homepage)

Returns: Array of discovered feed objects with title, description, URL, and subscriber count.

Examples:
  - Search by keyword: {keyword: "technology"}
  - Discover from URL: {url: "https://example.com"}`,
        query: {
            path: '/discover',
            method: 'POST'
        },
        input: {
            keyword: z.string().optional().describe('Keyword to search for feeds'),
            url: z.string().url().optional().describe('URL to discover RSS feeds from')
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    get_profile: {
        name: 'get_profile',
        description: `Get the current user's profile, session info, and subscription limits.

Args: None required.

Returns: User profile with name, email, role (free/pro), subscription limits, and session expiry.

Examples:
  - Get current user info: {}`,
        query: {
            path: '/better-auth/get-session',
            method: 'GET'
        },
        input: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    }
};

const server = new McpServer({
    name: 'folo-mcp',
    version: '1.0.0'
});
for (const tool of Object.keys(tools)){
    const { name, description, input, query, annotations: _annotations } = tools[tool];
    server.tool(name, description, input, async (args)=>sendApiQuery({
            ...query,
            args
        }));
}
const transport = new StdioServerTransport();
await server.connect(transport);
