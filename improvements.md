# Codebase Improvement Report

This document outlines identified issues, potential improvements, and proposed refactors for the Pirate Radio codebase.

## 1. Architecture & Structure

### **Problem: Logic Duplication in Playlist Generation**
- **Status**: [RESOLVED]
- **Resolution**: Implemented unified `PlaylistService` with `LocalFileSystemStrategy` and `FTPStrategy`. Shared generator logic is now used by both `scripts/generate-playlists.ts` and `src/utils/ftp-scanner.ts`.

### **Problem: Telegram Bot Organization**
- **Status**: [RESOLVED]
- **Resolution**: Bot logic has been refactored into `src/bot` with modular handlers, commands, and session management. `scripts/test-bot-local.ts` now imports from this structure.

### **Problem: Lack of Testing Strategy**
- **Observation**: There are no unit or integration tests found in the codebase. The only "test" is `test-bot-local.ts` which is actually the production bot script.
- **Impact**: High risk of regressions during refactoring.
- **Proposal**:
  - Initialize a testing framework (Vitest is good for Astro/Vite projects).
  - Add unit tests for utility functions (`validatePlaylistName`, `formatTime`).
  - Add integration tests for the bot command handlers (once refactored).

## 2. Code Quality & Refactoring

### **Problem: `AudioPlayer.tsx` Complexity**
- **Status**: [RESOLVED]
- **Resolution**: Refactored to use `useReducer` for state management and `useAudioElement` hook for DOM interactions. Constants moved to `src/constants.ts`.

### **Problem: Type Safety**
- **Observation**: Frequent use of `any` in error handling (e.g., `catch (error: any)`) and some API responses.
- **Impact**: Reduces type safety and masks potential runtime errors.
- **Proposal**:
  - Define custom Error types for domain-specific errors (e.g., `DownloadError`, `FTPError`).
  - Use Zod or similar for runtime validation of external data (API responses, environment variables).

### **Problem: Hardcoded Values & Magic Strings**
- **Status**: [RESOLVED]
- **Resolution**: Created `src/constants.ts` and migrated hardcoded values.

## 3. Performance & Optimization

### **Problem: FTP Connection Management**
- **Status**: [PARTIALLY RESOLVED]
- **Resolution**: Implemented `Promise.all` for parallel scanning (solving the sequential scan issue).
- **Remaining Issue**: Connection pooling is not fully implemented; new connections are still created for each operation, though they run in parallel now.

### **Problem: API Performance Bottleneck**
- **Status**: [RESOLVED]
- **Resolution**: Implemented `getPlaylistCache` with TTL-based caching in `playlists.json.ts`.



### **Problem: Large File Handling**
- **Observation**: `downloadSongAsBuffer` reads the entire song into memory (`Buffer`).
- **Impact**: High memory usage, especially for concurrent downloads.
- **Proposal**: Stream data directly from download to upload where possible, or use temporary file streams instead of loading full buffers into RAM.

## 4. Security & Reliability

### **Problem: Error Handling Consistency**
- **Observation**: Error handling logic (logging, user notification) is repeated across many try/catch blocks.
- **Impact**: Inconsistent user experience; verbose code.
- **Proposal**: Create a centralized `ErrorHandler` service that standardizes logging and user-facing error messages.

### **Problem: Environment Variable Validation**
- **Status**: [RESOLVED]
- **Resolution**: Implemented `src/utils/env-validation.ts` and integrated it into bot startup.

### **Problem: In-Memory Rate Limiting**
- **Observation**: `scripts/test-bot-local.ts` uses a simple `Map` for rate limiting.
- **Impact**: Rate limits are reset if the bot restarts; does not work if scaled to multiple instances.
- **Proposal**: Use a persistent store for rate limiting (Redis, database, or even a file-based store for simple setups).

## 5. Proposed Refactor Plan

1.  **Phase 1: Cleanup & Safety**
    -   Centralize constants.
    -   Add environment variable validation.
    -   Standardize error types.

2.  **Phase 2: Bot Refactor**
    -   Split `test-bot-local.ts` into modules.
    -   Move bot code to `src/bot/` (even if run via script).

3.  **Phase 3: Core Logic Unification**
    -   Refactor playlist generation to use a shared core.
    -   Optimize `AudioPlayer` state management.

4.  **Phase 4: Optimization**
    -   Implement streaming for file uploads.
    -   Implement streaming for file uploads.
    -   Optimize FTP connection usage.
    -   Implement caching for `playlists.json` API.

5.  **Phase 5: Testing**
    -   Set up Vitest.
    -   Write unit tests for core utilities.
