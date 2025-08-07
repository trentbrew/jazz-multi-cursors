# Multi-Browser Collaboration Testing

This document outlines the testing strategy for the multi-cursor collaboration feature, including Safari-specific fixes and comprehensive test suites.

## Safari Sync Issues & Fixes

### Common Safari Problems:

1. **Stricter localStorage policies** - Safari has more restrictive storage access
2. **Session handling differences** - Safari manages sessions differently than Chrome/Firefox
3. **Cookie policies** - Safari has stricter cookie management
4. **Network request handling** - Safari may handle concurrent requests differently

### Implemented Fixes:

#### 1. Safari Detection

```typescript
function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
```

#### 2. Safari-Specific Session Clearing

```typescript
function clearSafariSessions() {
  if (isSafari()) {
    // More aggressive session clearing for Safari
    localStorage.clear();
    sessionStorage.clear();
    // Clear cookies with domain-specific approach
  }
}
```

#### 3. Enhanced Retry Logic

- Safari gets 3 retry attempts vs 1 for other browsers
- Session clearing between retries
- 1-second delays between attempts

#### 4. Browser-Specific Error Handling

```typescript
const maxRetries = isSafari() ? 3 : 1;
```

## Testing Strategy

### 1. Manual Testing Checklist

#### Basic Functionality:

- [ ] Create new room
- [ ] Copy shareable link
- [ ] Join existing room via link
- [ ] Cursor sync between browsers
- [ ] Flow data sync between browsers
- [ ] Room ID display

#### Browser Compatibility:

- [ ] Chrome ↔ Chrome sync
- [ ] Firefox ↔ Firefox sync
- [ ] Safari ↔ Safari sync
- [ ] Chrome ↔ Firefox sync
- [ ] Chrome ↔ Safari sync
- [ ] Firefox ↔ Safari sync

#### Error Scenarios:

- [ ] Network disconnection recovery
- [ ] Session conflict resolution
- [ ] Invalid room URL handling
- [ ] Browser refresh during collaboration

### 2. Automated Testing with Playwright

#### Installation:

```bash
pnpm install
pnpm exec playwright install
```

#### Running Tests:

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI (interactive)
pnpm test:e2e:ui

# Run with debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm exec playwright test multi-browser-collaboration.spec.ts
```

#### Test Categories:

##### Core Functionality Tests:

- Room creation and sharing
- Clipboard API testing
- URL parameter handling
- Session management

##### Multi-Browser Tests:

- Cross-browser cursor sync
- Safari-specific session conflicts
- Concurrent user scenarios
- Network resilience

##### Performance Tests:

- Multiple concurrent users (5+ browsers)
- Stress testing with rapid cursor movements
- Memory usage monitoring

### 3. Test Scenarios

#### Scenario 1: Basic Room Sharing

1. User A creates room
2. User A copies share link
3. User B opens link
4. Verify both users see same room ID
5. Verify cursor sync works

#### Scenario 2: Safari Compatibility

1. User A (Chrome) creates room
2. User B (Safari) joins room
3. Verify Safari detection works
4. Verify session conflict resolution
5. Verify sync works despite initial conflicts

#### Scenario 3: Network Resilience

1. Start collaboration between 3 browsers
2. Simulate network disconnection
3. Verify graceful error handling
4. Verify recovery when network returns

#### Scenario 4: Concurrent Users

1. Open 5+ browser instances
2. All join same room
3. Simulate concurrent cursor movements
4. Verify all browsers stay responsive
5. Verify sync across all instances

## Debugging Tips

### 1. Console Logging

The app includes comprehensive debug logging:

```javascript
console.log('=== ROOM SHARING DEBUG INFO ===');
console.log('Room ID:', roomId);
console.log('Browser:', isSafari() ? 'Safari' : 'Other');
console.log('Container ID:', cursorContainer.id);
```

### 2. Safari-Specific Debugging

- Check for "Safari detected" messages
- Monitor session clearing attempts
- Verify retry logic execution

### 3. Network Debugging

- Use browser DevTools Network tab
- Monitor WebSocket connections
- Check for failed requests

### 4. Session Debugging

- Clear all browser data
- Test in incognito/private mode
- Check localStorage/sessionStorage state

## Performance Monitoring

### Key Metrics:

- **Connection Time**: Time to establish room connection
- **Sync Latency**: Time for cursor changes to appear
- **Memory Usage**: Browser memory consumption
- **CPU Usage**: Browser CPU utilization
- **Network Requests**: Number of failed/successful requests

### Monitoring Tools:

- Browser DevTools Performance tab
- Network tab for request monitoring
- Memory tab for memory usage
- Console for error tracking

## Best Practices

### 1. Testing Environment

- Use consistent network conditions
- Test on different devices/browsers
- Monitor system resources during tests

### 2. Error Handling

- Always test error scenarios
- Verify graceful degradation
- Test recovery mechanisms

### 3. User Experience

- Test with real user workflows
- Verify intuitive sharing process
- Ensure responsive UI during sync

### 4. Cross-Browser Compatibility

- Test on all major browsers
- Pay special attention to Safari
- Verify mobile browser compatibility

## Troubleshooting

### Common Issues:

#### Safari Not Syncing:

1. Check Safari detection is working
2. Verify session clearing is executed
3. Monitor retry attempts in console
4. Try clearing Safari data manually

#### Cursor Sync Delays:

1. Check network connectivity
2. Monitor WebSocket connections
3. Verify room ID consistency
4. Check for console errors

#### Room Creation Fails:

1. Verify group loading
2. Check for session conflicts
3. Monitor container creation
4. Verify URL parameters

### Debug Commands:

```bash
# Clear all browser data
# Chrome: Settings > Privacy > Clear browsing data
# Safari: Develop > Empty Caches
# Firefox: Options > Privacy > Clear Data

# Test in incognito mode
# All browsers support this for isolated testing

# Monitor network requests
# Use browser DevTools Network tab
```

This testing approach ensures robust multi-browser collaboration with special attention to Safari's unique requirements.
