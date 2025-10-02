// Jest setup file
import '@testing-library/jest-dom'

// Mock navigation function
jest.mock('@/shared/utils/navigation', () => ({
  navigateToLogin: jest.fn(),
}))

// Mock MUI date pickers in test environment
jest.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ value, onChange, label, ...props }: any) => {
    const React = require('react')
    return React.createElement('input', {
      type: 'date',
      'aria-label': label,
      value: value?.format?.('YYYY-MM-DD') || '',
      onChange: (e: any) => onChange?.(e.target.value),
      ...props
    })
  },
}))

// Mock chart components for lighter testing
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  LineChart: () => 'LineChart',
  Line: () => 'Line',
  XAxis: () => 'XAxis',
  YAxis: () => 'YAxis',
  CartesianGrid: () => 'CartesianGrid',
  Tooltip: () => 'Tooltip',
  Legend: () => 'Legend',
  PieChart: () => 'PieChart',
  Pie: () => 'Pie',
  BarChart: () => 'BarChart',
  Bar: () => 'Bar',
}))

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock Google Analytics gtag
Object.defineProperty(window, 'gtag', {
  writable: true,
  value: jest.fn(),
})

Object.defineProperty(window, 'dataLayer', {
  writable: true,
  value: [],
})