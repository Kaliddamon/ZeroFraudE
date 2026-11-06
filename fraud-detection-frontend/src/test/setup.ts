import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'

// Polyfill ProgressEvent if missing in environment
class PolyfilledProgressEvent extends Event {
  lengthComputable = false
  loaded = 0
  total = 0
}
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = PolyfilledProgressEvent as unknown as typeof globalThis.ProgressEvent
}
if (typeof global !== 'undefined' && typeof (global as unknown as { ProgressEvent: unknown }).ProgressEvent === 'undefined') {
  (global as unknown as { ProgressEvent: unknown }).ProgressEvent = PolyfilledProgressEvent
}
if (typeof window !== 'undefined' && typeof window.ProgressEvent === 'undefined') {
  window.ProgressEvent = PolyfilledProgressEvent as unknown as typeof window.ProgressEvent
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
