# API Documentation
## My Tracker Application

**Version:** 1.0  
**Last Updated:** 2024

---

## External API Overview

My Tracker integrates with the auodexpress.com tracking API to retrieve shipping status information. Due to CORS restrictions, the application uses a CORS proxy service to make requests from the browser.

### API Provider
- **Service**: auodexpress.com
- **Base URL**: `http://sys-new-api.auodexpress.com`
- **API Path**: `/api/tms/userSys/client/getRouterList`
- **Full URL**: `http://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList`

## Endpoint Details

### Get Router List (Tracking Status)

**Endpoint**: `/api/tms/userSys/client/getRouterList`  
**Method**: `POST`  
**Content-Type**: `application/json`

#### Request

**Headers**:
```
Accept: /
Content-Type: application/json
```

**Request Body**:
```json
{
  "wayBillCode": "TRACKING_NUMBER"
}
```

**Example**:
```json
{
  "wayBillCode": "ABC123456789"
}
```

#### Response

**Success Response** (200 OK):

```json
{
  "data": {
    "hisList": [
      {
        "toStatus": "In Transit",
        "createDate": "2024-01-15T10:30:00Z"
      },
      {
        "toStatus": "Delivered",
        "createDate": "2024-01-16T14:20:00Z"
      }
    ],
    "wbInfo": {
      "expressCode": "EXPRESS123"
    }
  },
  "msg": "Success",
  "result": true
}
```

**TypeScript Interface**:
```typescript
interface ApiResponse {
  data: {
    hisList: Array<{
      toStatus: string;
      createDate: string;
    }>;
    wbInfo: {
      expressCode: string;
    };
  };
  msg: string;
  result: boolean;
}
```

**Response Fields**:
- `data.hisList`: Array of tracking history entries
  - `toStatus`: Current or historical status of the shipment (string)
  - `createDate`: ISO 8601 timestamp of when the status was recorded (string)
- `data.wbInfo`: Express information object
  - `expressCode`: Express code for the shipment (string) - displayed for delivered and in-transit items
- `msg`: Response message (string)
- `result`: Boolean indicating if the request was successful (boolean)

#### Error Responses

**Network Error**:
- **Cause**: Connection failure, timeout, or CORS proxy issues
- **Handling**: Caught by try-catch, displayed to user

**API Error**:
- **Status**: Non-200 HTTP status code
- **Handling**: Axios throws error, caught and displayed

**Invalid Tracking Number**:
- **Behavior**: API may return empty `hisList` array
- **Handling**: Application checks for empty array and displays accordingly

## CORS Configuration

### Problem

The auodexpress.com API does not include CORS headers that allow direct browser requests. This is a security measure to prevent unauthorized cross-origin requests.

### Solution: CORS Proxy

The application uses a CORS proxy service to forward requests:

**Proxy Service**: cors-anywhere.herokuapp.com  
**Proxy URL Format**: `https://cors-anywhere.herokuapp.com/{target_url}`

**Implementation**:
```typescript
const cors_api_host = 'cors-anywhere.herokuapp.com';
const cors_api_url = 'https://' + cors_api_host + '/';
const endpoint = cors_api_url + 'http://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList';
```

### CORS Proxy Activation

**Note**: The cors-anywhere.herokuapp.com service requires manual activation for first-time users:

1. Visit: `https://cors-anywhere.herokuapp.com/corsdemo`
2. Click "Request temporary access to the demo server"
3. This enables CORS proxy for your browser session

**Current Implementation**: The application includes an iframe pointing to the CORS demo page:
```tsx
<iframe src="https://cors-anywhere.herokuapp.com/corsdemo" width="100%" height="120" />
```

### Limitations

1. **External Dependency**: Relies on third-party proxy service
2. **Reliability**: Proxy service may be unavailable or rate-limited
3. **Security**: Proxy sees all request/response data
4. **Performance**: Additional network hop adds latency

### Future Alternatives

#### Option 1: Next.js API Route Proxy
Create a server-side API route in Next.js to proxy requests:

```typescript
// pages/api/track.ts or app/api/track/route.ts
export async function POST(request: Request) {
  const { wayBillCode } = await request.json();
  const response = await fetch(
    'http://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wayBillCode })
    }
  );
  return Response.json(await response.json());
}
```

**Benefits**:
- No external dependency
- Better security (API key can be server-side)
- Better performance (no extra hop)
- Full control

**Drawbacks**:
- Requires server-side deployment
- Additional server resources

#### Option 2: Self-Hosted CORS Proxy
Deploy your own CORS proxy service:

**Options**:
- cors-anywhere (Node.js)
- CORS proxy Docker container
- Cloudflare Workers

**Benefits**:
- Full control
- No dependency on external service
- Can customize behavior

**Drawbacks**:
- Additional infrastructure to maintain
- Hosting costs

## Request/Response Examples

### Example 1: Successful Request

**Request**:
```bash
POST https://cors-anywhere.herokuapp.com/http://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList
Content-Type: application/json

{
  "wayBillCode": "ABC123456789"
}
```

**Response**:
```json
{
  "data": {
    "hisList": [
      {
        "toStatus": "Package Received",
        "createDate": "2024-01-15T08:00:00Z"
      },
      {
        "toStatus": "In Transit",
        "createDate": "2024-01-15T12:30:00Z"
      },
      {
        "toStatus": "Out for Delivery",
        "createDate": "2024-01-16T09:15:00Z"
      }
    ],
    "wbInfo": {
      "expressCode": "EXPRESS123"
    }
  },
  "msg": "Success",
  "result": true
}
```

### Example 2: Empty Response (Invalid Tracking Number)

**Request**:
```json
{
  "wayBillCode": "INVALID123"
}
```

**Response**:
```json
{
  "data": {
    "hisList": [],
    "wbInfo": {
      "expressCode": ""
    }
  },
  "msg": "Tracking number not found",
  "result": false
}
```

**Application Handling**: The `ResultList` component checks for empty `hisList` and doesn't render a result for that tracking number.

### Example 3: Network Error

**Scenario**: CORS proxy is unavailable or network failure

**Error**: Axios throws network error

**Application Handling**:
```typescript
catch (error: unknown) {
  setError(error instanceof Error ? error.message : 'Unknown errors');
}
```

## Error Handling

### Error Types

1. **Network Errors**
   - Connection timeout
   - DNS resolution failure
   - CORS proxy unavailable
   - **Handling**: Display error message to user

2. **HTTP Errors**
   - 4xx: Client errors (bad request, not found, etc.)
   - 5xx: Server errors (internal server error, service unavailable)
   - **Handling**: Display error message, allow retry

3. **Invalid Responses**
   - Missing expected fields
   - Malformed JSON
   - **Handling**: Graceful degradation, skip invalid entries

### Current Error Handling Implementation

```typescript
const fetchData = async () => {
  try {
    const tmpList = [];
    setCount(texts.length);
    for (const text of texts) {
      const payload = { wayBillCode: text };
      const response = await axios.post(endpoint, payload, {
        headers: {
          Accept: '/',
          'Content-Type': 'application/json'
        }
      });
      tmpList.push(response.data);
      setResponses(tmpList);
      setCount(prev => prev - 1);
      setLoading(false);
      setError(null);
    }
  } catch (error: unknown) {
    setError(error instanceof Error ? error.message : 'Unknown errors');
  }
};
```

### Error Display

Errors are displayed in the UI:
```tsx
{error ? <p className="text-red-500">Error: {error}</p> : null}
```

## Rate Limiting

### Current Status

**No Rate Limiting**: The application makes sequential requests without rate limiting.

**Potential Issues**:
- May hit API rate limits with large batches
- CORS proxy may have rate limits
- No retry logic for rate-limited requests

### Future Considerations

1. **Implement Rate Limiting**:
   - Add delays between requests
   - Respect API rate limits
   - Implement exponential backoff

2. **Batch Processing**:
   - Group requests into batches
   - Process batches with delays
   - Show progress for each batch

3. **Request Queue**:
   - Queue requests
   - Process queue with rate limiting
   - Retry failed requests

## API Usage in Application

### Component Integration

**Location**: `src/app/track/page.tsx`

**Function**: `fetchData()`

**Process**:
1. Iterate through `texts` array
2. For each tracking number:
   - Check if existing result exists and is delivered (status contains "感谢使用")
   - If delivered: Skip API call, use cached result, decrement counter
   - If not delivered or new:
     - Create payload `{ wayBillCode: text }`
     - Make POST request via CORS proxy
     - Append response to `tmpList`
     - Update `responses` state
     - Decrement `count` counter
3. Handle errors with try-catch

**State Updates**:
- `responses`: Updated after each successful API call
- `count`: Decremented after each API call
- `loading`: Set to false after all calls complete
- `error`: Set if any call fails

### Response Processing

**Location**: `src/app/track/resultList.tsx`

**Process**:
1. Map through `results` array
2. For each result:
   - Check if `result.data.hisList` exists and has items
   - Extract first item's `toStatus` and `createDate`
   - Check status for classification:
     - Delivered: Contains "感谢使用" → Red styling
     - In Transit: Contains "您的快件" or "正在派件" → Amber/yellow styling
     - Other: Default styling
   - Extract `wbInfo.expressCode` for delivered and in-transit items
   - Display with corresponding `trackNo[index]`, date, status, and express code (if applicable)
3. Skip invalid/empty results
4. Display error messages when `result.result === false`

## Testing API Integration

### Manual Testing

1. **Valid Tracking Number**:
   - Enter a valid tracking number
   - Submit and verify status display

2. **Invalid Tracking Number**:
   - Enter invalid/non-existent tracking number
   - Verify empty result handling

3. **Multiple Tracking Numbers**:
   - Enter multiple tracking numbers
   - Verify batch processing
   - Verify progress counter

4. **Network Error**:
   - Disconnect network
   - Submit request
   - Verify error display

5. **CORS Proxy**:
   - Verify CORS proxy activation
   - Test without activation (should fail)

### Automated Testing (Future)

**Unit Tests**:
- Test API request formatting
- Test response parsing
- Test error handling

**Integration Tests**:
- Mock API responses
- Test component integration
- Test error scenarios

**E2E Tests**:
- Test full user flow
- Test with real API (staging environment)
- Test error recovery

## Security Considerations

### Current Security

1. **No Authentication**: API requests are unauthenticated
2. **Client-Side Requests**: Requests made from browser
3. **CORS Proxy**: Third-party service sees all data
4. **No Input Validation**: Accepts any tracking number format

### Security Recommendations

1. **Input Validation**: Validate tracking number format before API call
2. **Rate Limiting**: Prevent abuse with client-side rate limiting
3. **Error Message Sanitization**: Don't expose sensitive API details
4. **HTTPS**: Ensure all requests use HTTPS (currently using HTTP for API)
5. **API Key**: If API requires authentication, use server-side proxy

---

*This API documentation will be updated as integration evolves.*
