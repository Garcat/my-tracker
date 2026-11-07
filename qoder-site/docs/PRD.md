# Product Requirements Document (PRD)
## My Tracker Application

**Version:** 0.2.0
**Last Updated:** 2025-01-27  
**Status:** Active Development

---

## Executive Summary

My Tracker is a web-based application designed to help users track multiple shipping/tracking numbers simultaneously. The application provides a simple, efficient interface for querying tracking status from the auodexpress.com API and displaying results in real-time.

## Product Goals

### Primary Goals
1. Enable users to track multiple shipping numbers in a single interface
2. Provide real-time status updates with progress tracking
3. Persist user input data across sessions
4. Deliver a fast, responsive user experience

### Secondary Goals
1. Support cross-device data synchronization (via Supabase migration)
2. Maintain a clean, intuitive user interface
3. Handle API errors gracefully
4. Support batch processing of tracking queries

## User Personas

### Primary Persona: Logistics Coordinator
- **Role**: Manages multiple shipments daily
- **Needs**: Quick access to tracking status for multiple packages
- **Pain Points**: Switching between different tracking systems, manual copy-paste operations
- **Goals**: Efficiently monitor shipment statuses in one place

### Secondary Persona: E-commerce Manager
- **Role**: Oversees order fulfillment and shipping
- **Needs**: Track customer orders and delivery status
- **Pain Points**: Time-consuming individual tracking lookups
- **Goals**: Batch tracking operations to save time

## User Stories

### Story 1: Multi-Line Input
**As a** logistics coordinator  
**I want to** paste multiple tracking numbers at once  
**So that** I can track all my shipments efficiently

**Acceptance Criteria:**
- User can paste multiple tracking numbers (one per line)
- Application preserves line breaks and processes each line separately
- Input is automatically saved as user types

### Story 2: Batch Tracking Query
**As a** user  
**I want to** submit all tracking numbers at once  
**So that** I can get status updates for all shipments simultaneously

**Acceptance Criteria:**
- Submit button triggers API calls for all entered tracking numbers
- Progress counter shows remaining queries
- Results display as they become available

### Story 3: Data Persistence
**As a** user  
**I want** my tracking numbers to be saved automatically  
**So that** I don't lose my work when I refresh the page

**Acceptance Criteria:**
- Input data persists across browser sessions (currently localStorage)
- Data loads automatically on page load
- Future: Data syncs across devices (Supabase migration)

### Story 4: Status Display
**As a** user  
**I want to** see the status and creation date for each tracking number  
**So that** I can understand the current state of my shipments

**Acceptance Criteria:**
- Each tracking number displays with its corresponding status
- Creation date is shown alongside status
- Status is visually classified with color coding (delivered = red, in-transit = yellow, other = default)
- Express code is displayed for delivered and in-transit items
- Results are clearly formatted and easy to read

### Story 5: Smart Caching
**As a** user  
**I want** the system to skip querying already-delivered packages  
**So that** I get faster results and reduce unnecessary API calls

**Acceptance Criteria:**
- System checks existing results before making API calls
- Delivered items (status contains "感谢使用") are not re-queried
- Cached results are preserved and displayed immediately
- Progress counter accurately reflects remaining queries

## Feature Specifications

### Current Features

#### 1. Multi-Line Text Input
- **Description**: Textarea component accepting multiple tracking numbers
- **Input Format**: One tracking number per line
- **Validation**: None currently (accepts any text input)
- **Storage**: Saves to localStorage on each change

#### 2. Batch API Query Processing
- **Description**: Sequential API calls for each tracking number
- **Endpoint**: `http://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList`
- **Method**: POST
- **Payload**: `{ wayBillCode: string }`
- **Processing**: Sequential (one at a time)
- **Progress Tracking**: Counter shows remaining queries

#### 3. Result Display
- **Description**: Shows tracking status and creation date with visual status classification
- **Format**: List of results with tracking number, status, date, and express code (when available)
- **Update**: Real-time as each API call completes
- **Component**: `ResultList` component
- **Status Classification**:
  - **Delivered** (已送达): Red border and background (`border-destructive/50 bg-destructive/5`) - Status contains "感谢使用"
  - **In Transit** (运输中): Amber/yellow border and background (`border-amber-500/50 bg-amber-50/50`) - Status contains "您的快件" or "正在派件"
  - **Other Status**: Default border styling
- **Express Code Display**: Shows `wbInfo.expressCode` for delivered and in-transit items

#### 4. Error Handling
- **Description**: Catches and displays API errors with detailed messages
- **Display**: 
  - Error message shown in red text with destructive styling
  - API error messages (`result.msg`) displayed when `result.result === false`
  - Network errors displayed with user-friendly messages
- **Recovery**: User can retry submission

#### 5. Loading States
- **Description**: Visual feedback during API calls
- **Indicators**: Loading text and progress counter
- **State Management**: React useState hooks

#### 6. Smart Caching
- **Description**: Intelligent caching mechanism to avoid redundant API calls
- **Logic**: 
  - Before making API call, checks if tracking number already has a delivered status
  - Delivered items (status contains "感谢使用") are skipped from API queries
  - Preserves existing results for delivered items
- **Benefits**: 
  - Reduces API calls and improves performance
  - Faster response times for batches with already-delivered items
  - Better user experience with instant display of cached results

### Planned Features (Supabase Migration)

#### 7. Cloud Storage
- **Description**: Replace localStorage with Supabase database
- **Benefits**: Cross-device synchronization, better data persistence
- **Implementation**: Anonymous access with session-based identification
- **Storage**: Array of tracking numbers per session

## Technical Requirements

### API Requirements
- **External API**: auodexpress.com tracking API
- **CORS Handling**: Requires CORS proxy (cors-anywhere.herokuapp.com)
- **Request Format**: JSON POST request
- **Response Format**: JSON with `data.hisList[]` containing status information and `data.wbInfo.expressCode` for express code
- **Error Handling**: Must handle network errors and API errors gracefully
- **Response Structure**: 
  ```typescript
  {
    data: {
      hisList: Array<{ toStatus: string; createDate: string }>,
      wbInfo: { expressCode: string }
    },
    msg: string,
    result: boolean
  }
  ```

### Data Model

#### Current (localStorage)
```typescript
{
  previousInputs: string[] // Array of tracking numbers
}
```

#### Planned (Supabase)
```sql
tracking_inputs {
  id: uuid (primary key)
  session_id: text (browser session identifier)
  inputs: text[] (array of tracking numbers)
  created_at: timestamp
  updated_at: timestamp
}
```

### Performance Requirements
- **Initial Load**: < 2 seconds
- **API Response**: Handle delays gracefully with progress indicators
- **Input Response**: Immediate feedback on text changes
- **Batch Processing**: Sequential processing acceptable for current scale

### Browser Compatibility
- **Minimum**: Modern browsers supporting ES2017+
- **Required Features**: localStorage, fetch/axios, React 19
- **Tested**: Chrome, Firefox, Safari, Edge (latest versions)

## Non-Functional Requirements

### Security
- **Current**: No authentication required
- **Data Privacy**: Tracking numbers stored locally (browser)
- **Future**: Anonymous Supabase access with session-based isolation
- **CORS**: Proxy required for external API access

### Scalability
- **Current**: Suitable for individual/small team use
- **Limitations**: Sequential API processing may be slow for large batches
- **Future**: Consider parallel processing for improved performance

### Usability
- **Interface**: Clean, minimal design with Tailwind CSS
- **Responsiveness**: Works on desktop and tablet (mobile optimization pending)
- **Accessibility**: Basic HTML semantics, could be improved

### Reliability
- **Error Recovery**: User can retry failed operations
- **Data Loss Prevention**: Auto-save on input change
- **API Resilience**: Error messages displayed to user

## Success Metrics

### User Engagement
- **Primary**: Number of tracking queries per session
- **Secondary**: Return user rate
- **Target**: Users track 5+ numbers per session

### Performance
- **Primary**: Average time to complete batch queries
- **Secondary**: Error rate
- **Target**: < 30 seconds for 10 tracking numbers

### Data Persistence
- **Primary**: Percentage of users who return to saved inputs
- **Secondary**: Cross-device usage (after Supabase migration)
- **Target**: 50%+ users utilize saved inputs

## Future Enhancements

### Short-term (Next Sprint)
1. **Supabase Migration**: Replace localStorage with cloud storage
2. **Input Validation**: Validate tracking number format
3. **Mobile Optimization**: Improve mobile UI/UX

### Medium-term (Next Quarter)
1. **Parallel Processing**: Process multiple API calls concurrently
2. **Caching**: Cache API responses to reduce redundant calls
3. **Export Functionality**: Export results to CSV/Excel
4. **History**: Track query history with timestamps

### Long-term (Future)
1. **User Authentication**: Optional user accounts for personal data
2. **Multiple Carrier Support**: Support multiple shipping carriers
3. **Notifications**: Email/push notifications for status changes
4. **Dashboard**: Analytics and reporting features
5. **API Rate Limiting**: Handle API rate limits gracefully

## Technical Constraints

### Current Constraints
1. **CORS Proxy Dependency**: Relies on external CORS proxy service
2. **Sequential Processing**: API calls processed one at a time
3. **Local Storage Only**: Data limited to single browser/device
4. **Single API Source**: Only supports auodexpress.com API

### Future Considerations
1. **Proxy Reliability**: Consider self-hosted CORS proxy
2. **API Rate Limits**: May need to implement rate limiting
3. **Database Costs**: Monitor Supabase usage and costs
4. **Scalability**: Plan for increased concurrent users

## Dependencies

### External Services
- **CORS Proxy**: cors-anywhere.herokuapp.com (current)
- **Tracking API**: sys-new-api.auodexpress.com
- **Future**: Supabase (database service)

### Technology Stack
- Next.js 15.1.2
- React 19.0.0
- TypeScript 5
- Tailwind CSS 3.4.1
- Axios 1.7.9
- Material-UI 6.3.0

## Approval

**Product Owner**: [To be assigned]  
**Technical Lead**: [To be assigned]  
**Date**: [To be filled]

---

*This PRD is a living document and will be updated as the product evolves.*
