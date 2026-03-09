import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Cleanup after each test to avoid memory leaks
 */
afterEach(() => {
  cleanup()
})

/**
 * Mock Firebase module to avoid authentication errors in tests
 */
vi.mock('../firebase', () => ({
  default: {
    auth: {
      currentUser: null,
      onAuthStateChanged: vi.fn((callback) => callback(null)),
      signOut: vi.fn(),
    }
  }
}))

/**
 * Mock window.matchMedia for responsive component tests
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
