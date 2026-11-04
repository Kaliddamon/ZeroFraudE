import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'

// Polyfill ProgressEvent if missing in environment
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class ProgressEvent extends Event {
    lengthComputable = false
    loaded = 0
    total = 0
  } as unknown as typeof globalThis.ProgressEvent
}

const server = setupServer(...handlers)
export { server }

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  server.resetHandlers()
})
afterAll(() => server.close())
