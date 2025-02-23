Here's a comprehensive documentation guide for the project:

# LLM Dashboard Documentation

## Overview
This dashboard provides a comprehensive interface for monitoring and analyzing LLM (Large Language Model) interactions. It allows users to view, search, and analyze logs of LLM calls, organized by sessions and individual runs.

## Project Structure

### Core Types (`/src/types/logs.ts`)
Contains the core TypeScript interfaces that define the shape of our data:

- `Message`: Represents a single message in an LLM conversation
  ```typescript
  interface Message {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  }
  ```

- `LLMRun`: Represents a complete LLM interaction including context
  ```typescript
  interface LLMRun {
    session_id: string;
    messages: Message[];
    response_texts: string[];
    stack_trace?: StackFrame[];
    // ... other fields
  }
  ```

- `SessionRow`: Groups related LLM runs together
  ```typescript
  interface SessionRow {
    sessionId: string;
    runs: LLMRun[];
    callCount: number;
    firstCall: number;
    lastCall: number;
    totalTokens: number;
  }
  ```

### Components

#### Layout Components

##### `DashboardLayout.tsx`
The main layout component that provides:
- File selection sidebar
- Log file search functionality
- Main content area

Usage:
```typescript
<DashboardLayout>
  {/* Your content here */}
</DashboardLayout>
```

##### `ListContainer.tsx`
A reusable container component for list views that provides consistent styling and structure:
```typescript
<ListContainer 
  title="Your Title"
  headerContent={<YourHeaderContent />}
>
  {/* List content */}
</ListContainer>
```

#### View Components

##### `RunsList.tsx`
Displays individual LLM runs with:
- Search functionality
- Stack trace visualization
- Run details expansion
- Filtering by caller and request ID

##### `SessionsList.tsx`
Groups runs into sessions with:
- Session-based organization
- Aggregated metrics
- Expandable session details

##### `CallHierarchy.tsx`
Visualizes the call stack for LLM interactions:
- Tree view of function calls
- Stack trace navigation
- Code context display

#### Utility Components

##### `SearchInput.tsx`
Reusable search input component with consistent styling:
```typescript
<SearchInput
  value={searchTerm}
  onChange={setSearchTerm}
  placeholder="Search..."
/>
```

##### `LoadingState.tsx`
Handles loading and empty states consistently:
```typescript
<LoadingState
  isLoading={isLoading}
  isEmpty={items.length === 0}
  emptyMessage="No items found"
/>
```

### Hooks

#### `useLogs.ts`
Central hook for fetching and managing log data:
```typescript
const { runs, sessions, isLoading, error } = useLogs(selectedFile);
```

Features:
- Automatic data fetching
- Error handling
- Loading state management
- Session grouping

### Utilities

#### `sessionUtils.ts`
Provides utilities for working with sessions:
```typescript
const sessions = groupRunsIntoSessions(runs);
```

#### `filterUtils.ts`
Utilities for filtering logs and messages:
```typescript
const filteredRuns = runs.filter(run => runContainsText(run, searchTerm));
```

## State Management

### Log File Context
Managed through `LogFileContext.tsx`:
- Handles selected file state
- Provides file selection functionality
- Manages file list updates

## Contributing Guidelines

### Component Structure
1. Use functional components with TypeScript
2. Implement proper type definitions
3. Use shared components for consistency
4. Handle loading and error states

### Code Style
1. Use consistent naming:
   - Components: PascalCase
   - Utilities: camelCase
   - Types/Interfaces: PascalCase
2. Group related functionality
3. Use TypeScript strictly
4. Document complex logic

### Adding New Features

1. **New Component Checklist**:
   - TypeScript interfaces
   - Error handling
   - Loading states
   - Proper prop types
   - Reusable components

2. **State Management**:
   - Use hooks for complex state
   - Consider context for shared state
   - Implement proper cleanup

3. **Performance Considerations**:
   - Memoize expensive calculations
   - Use pagination for large lists
   - Implement virtual scrolling when needed

### Testing

1. **Component Testing**:
   ```typescript
   describe('ComponentName', () => {
     it('should render correctly', () => {
       // Test implementation
     });
   });
   ```

2. **Utility Testing**:
   ```typescript
   describe('utilityName', () => {
     it('should handle expected cases', () => {
       // Test implementation
     });
   });
   ```

## Common Patterns

### Error Handling
```typescript
try {
  // Async operation
} catch (error) {
  console.error('Error description:', error);
  // Handle error appropriately
} finally {
  // Cleanup if needed
}
```

### Loading States
```typescript
{isLoading ? (
  <LoadingState />
) : error ? (
  <ErrorMessage error={error} />
) : (
  <YourComponent data={data} />
)}
```

### Search Implementation
```typescript
const filteredItems = useMemo(() => 
  items.filter(item => searchFunction(item, searchTerm)),
  [items, searchTerm]
);
```

## Best Practices

1. **Component Organization**:
   - Keep components focused and single-purpose
   - Extract reusable logic into hooks
   - Use shared components for common patterns

2. **Performance**:
   - Implement proper memoization
   - Use virtual scrolling for large lists
   - Optimize re-renders

3. **Accessibility**:
   - Include proper ARIA labels
   - Ensure keyboard navigation
   - Maintain proper contrast ratios

4. **Error Handling**:
   - Implement proper error boundaries
   - Provide meaningful error messages
   - Handle edge cases appropriately

## Deployment

1. **Build Process**:
   ```bash
   npm run build
   ```

2. **Environment Variables**:
   ```env
   REACT_APP_API_URL=http://your-api-url
   ```

3. **Production Considerations**:
   - Enable error tracking
   - Implement proper logging
   - Configure performance monitoring

## Troubleshooting

Common issues and solutions:

1. **Data Not Loading**:
   - Check API endpoint configuration
   - Verify file permissions
   - Check network requests

2. **Performance Issues**:
   - Implement pagination
   - Add memoization
   - Check for unnecessary re-renders

3. **Type Errors**:
   - Verify interface definitions
   - Check for null/undefined handling
   - Ensure proper type imports
