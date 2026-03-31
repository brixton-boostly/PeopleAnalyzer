import { render, screen, fireEvent } from '@testing-library/react'
import { NineBoxCell } from '@/components/ninebox/NineBoxCell'
import type { PerfLevel } from '@/lib/types'

const cell = {
  performance: 'high' as PerfLevel,
  potential: 'high' as PerfLevel,
  label: 'Superstar',
  description: 'Future leaders',
  color: '#d1fae5',
  textColor: '#065f46',
}

it('renders title and description', () => {
  render(
    <NineBoxCell cell={cell} placedNames={[]} onPlace={() => {}} isDropTarget={false} selectedEmployee={null} />
  )
  expect(screen.getByText('Superstar')).toBeInTheDocument()
  expect(screen.getByText('Future leaders')).toBeInTheDocument()
})

it('renders placed names', () => {
  render(
    <NineBoxCell cell={cell} placedNames={['Alex Rivera', 'Sam Patel']} onPlace={() => {}} isDropTarget={false} selectedEmployee={null} />
  )
  expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
})

it('shows +N more when more than 4 names', () => {
  render(
    <NineBoxCell cell={cell} placedNames={['A', 'B', 'C', 'D', 'E', 'F']} onPlace={() => {}} isDropTarget={false} selectedEmployee={null} />
  )
  expect(screen.getByText('+2 more')).toBeInTheDocument()
})

it('calls onPlace when clicked with a selected employee', () => {
  const onPlace = jest.fn()
  render(
    <NineBoxCell
      cell={cell}
      placedNames={[]}
      onPlace={onPlace}
      isDropTarget={false}
      selectedEmployee={{ id: '1', full_name: 'Alex Rivera', job_title: null }}
    />
  )
  fireEvent.click(screen.getByRole('button'))
  expect(onPlace).toHaveBeenCalledWith('high', 'high')
})
