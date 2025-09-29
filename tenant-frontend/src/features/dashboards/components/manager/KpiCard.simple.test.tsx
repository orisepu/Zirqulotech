import { render, screen } from '../../../test-utils'
import KpiCard from './KpiCard'

describe('KpiCard - Simple Tests', () => {
  it('should render title and value', () => {
    render(<KpiCard title="Test Title" value={100} />)

    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('should render dash for null values', () => {
    render(<KpiCard title="Empty" value={null} />)

    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('should render string values as-is', () => {
    render(<KpiCard title="Status" value="Active" />)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('should render helper text when provided', () => {
    render(<KpiCard title="Sales" value={500} helper="Last month" />)

    expect(screen.getByText('Sales')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Last month')).toBeInTheDocument()
  })

  it('should handle zero values', () => {
    render(<KpiCard title="Zero Test" value={0} />)

    expect(screen.getByText('Zero Test')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})