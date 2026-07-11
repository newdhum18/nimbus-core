# Architecture

```text
iPhone / Browser
      |
      v
Cloudflare Pages (static frontend)
      |
      v
Cloudflare Worker API
      |
      +----> D1
      |
      +----> Queue producer
                  |
                  v
             Cloudflare Queue
                  |
                  v
             Worker consumer
                  |
                  +----> fetch
                  +----> extract
                  +----> persist
                  +----> metrics
                  +----> events
```

The Worker entry file only coordinates Fetch and Queue handlers.
Business logic remains separated by package.
