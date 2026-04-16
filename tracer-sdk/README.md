# tracer-sdk

Lightweight product analytics SDK for the [Tracer](https://github.com/Sreevarsh-Mahesh/Tracer) dashboard.

Captures clicks, hovers, mouse movements, rage clicks, and custom events on any website. Zero dependencies. < 4KB gzipped.

## Installation

```bash
npm install tracer-sdk
```

## Quick Start

```typescript
import tracer from 'tracer-sdk';

// Initialize once on app mount
const cleanup = tracer.init({
  projectId: 'my-app',
  apiKey: 'tk_live_abc123',
  endpoint: 'https://your-tracer-dashboard.vercel.app/api/ingest'
});

// Optional: track custom events
tracer.track('signup_complete', { plan: 'pro' });

// Cleanup on unmount (React example)
// useEffect(() => { return cleanup; }, []);
```

## How It Works

1. **Add `data-tracer-id` to elements** you want to track:

```html
<button data-tracer-id="checkout" data-tracer-label="Checkout">
  Buy Now
</button>
```

2. **The SDK automatically captures:**
   - **Clicks** on tracked elements (with repeat-click / rage-click detection)
   - **Hover duration** on tracked elements
   - **Mouse movements** (throttled, normalized to viewport %)
   - **Impressions** (which tracked elements are visible on load)
   - **Route** (page path on init)

3. **Events are batched** and flushed every 5 seconds (configurable) or on:
   - Page unload (`beforeunload`)
   - Tab hide (`visibilitychange`)
   - Batch size limit (default 200 events)

4. **`sendBeacon`** is used as the primary transport (works during page unload),
   with a `fetch` fallback.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectId` | `string` | **required** | Your project ID from the Tracer dashboard |
| `apiKey` | `string` | **required** | API key from dashboard settings |
| `endpoint` | `string` | **required** | Ingestion URL (`https://your-dashboard.vercel.app/api/ingest`) |
| `route` | `string` | `location.pathname` | Override the detected route |
| `userLabel` | `string` | `"Anonymous"` | Label for this user's session |
| `userSegment` | `string` | `"default"` | Segment for journey clustering |
| `flushIntervalMs` | `number` | `5000` | How often to send batches (ms) |
| `maxBatchSize` | `number` | `200` | Max events before auto-flush |
| `mouseMoveThrottleMs` | `number` | `150` | Mouse-move capture frequency (ms) |

## API

### `tracer.init(options): () => void`

Initialize tracking. Returns a cleanup function.

### `tracer.track(name, payload?): void`

Log a custom named event with optional key-value payload.

### `tracer.flush(): void`

Manually flush the event queue.

### `tracer.destroy(): void`

Tear down all listeners and flush remaining events.

## React Integration

```tsx
import { useEffect } from 'react';
import tracer from 'tracer-sdk';

function App() {
  useEffect(() => {
    return tracer.init({
      projectId: 'my-app',
      apiKey: 'tk_live_abc123',
      endpoint: '/api/ingest'
    });
  }, []);

  return (
    <div>
      <button data-tracer-id="signup" data-tracer-label="Sign Up">
        Get Started
      </button>
    </div>
  );
}
```

## License

MIT
