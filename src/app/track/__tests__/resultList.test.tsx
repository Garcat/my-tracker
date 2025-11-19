import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultList from '../resultList';

describe('ResultList', () => {
  const mockTrackNo = ['TRACK001', 'TRACK002', 'TRACK003'];

  it('renders delivered items with correct styling', () => {
    const mockResults = [
      {
        data: {
          hisList: [
            {
              toStatus: '感谢使用',
              createDate: '2024-01-01 10:00:00',
            },
          ],
          wbInfo: {
            expressCode: 'EXPRESS123',
          },
        },
        msg: 'Success',
        result: true,
      },
    ];

    render(<ResultList trackNo={[mockTrackNo[0]]} results={mockResults} />);

    const item = screen.getByText(/TRACK001/);
    expect(item).toBeInTheDocument();
    const cardDiv = item.closest('.p-4.rounded-lg.border');
    expect(cardDiv).toHaveClass('border-destructive/50', 'bg-destructive/5');
  });

  it('renders in-transit items with correct styling', () => {
    const mockResults = [
      {
        data: {
          hisList: [
            {
              toStatus: '您的快件正在运输中',
              createDate: '2024-01-01 10:00:00',
            },
          ],
          wbInfo: {
            expressCode: 'EXPRESS456',
          },
        },
        msg: 'Success',
        result: true,
      },
    ];

    render(<ResultList trackNo={[mockTrackNo[0]]} results={mockResults} />);

    const item = screen.getByText(/TRACK001/);
    expect(item).toBeInTheDocument();
    const cardDiv = item.closest('.p-4.rounded-lg.border');
    expect(cardDiv).toHaveClass('border-amber-500/50', 'bg-amber-50/50');
  });

  it('renders regular items with default styling', () => {
    const mockResults = [
      {
        data: {
          hisList: [
            {
              toStatus: 'Package received',
              createDate: '2024-01-01 10:00:00',
            },
          ],
          wbInfo: {
            expressCode: 'EXPRESS789',
          },
        },
        msg: 'Success',
        result: true,
      },
    ];

    render(<ResultList trackNo={[mockTrackNo[0]]} results={mockResults} />);

    const item = screen.getByText(/TRACK001/);
    expect(item).toBeInTheDocument();
    const cardDiv = item.closest('.p-4.rounded-lg.border');
    expect(cardDiv).toHaveClass('border-border');
  });

  it('renders error messages when result is false', () => {
    const mockResults = [
      {
        data: {
          hisList: [],
          wbInfo: {
            expressCode: '',
          },
        },
        msg: 'Tracking number not found',
        result: false,
      },
    ];

    render(<ResultList trackNo={[mockTrackNo[0]]} results={mockResults} />);

    expect(screen.getByText('Tracking number not found')).toBeInTheDocument();
  });

  it('renders multiple items correctly', () => {
    const mockResults = [
      {
        data: {
          hisList: [
            {
              toStatus: '感谢使用',
              createDate: '2024-01-01 10:00:00',
            },
          ],
          wbInfo: {
            expressCode: 'EXPRESS123',
          },
        },
        msg: 'Success',
        result: true,
      },
      {
        data: {
          hisList: [
            {
              toStatus: '您的快件正在运输中',
              createDate: '2024-01-02 11:00:00',
            },
          ],
          wbInfo: {
            expressCode: 'EXPRESS456',
          },
        },
        msg: 'Success',
        result: true,
      },
    ];

    render(<ResultList trackNo={[mockTrackNo[0], mockTrackNo[1]]} results={mockResults} />);

    expect(screen.getByText(/TRACK001/)).toBeInTheDocument();
    expect(screen.getByText(/TRACK002/)).toBeInTheDocument();
  });

  it('includes express code in title for delivered and in-transit items', () => {
    const mockResults = [
      {
        data: {
          hisList: [
            {
              toStatus: '感谢使用',
              createDate: '2024-01-01 10:00:00',
            },
          ],
          wbInfo: {
            expressCode: 'EXPRESS123',
          },
        },
        msg: 'Success',
        result: true,
      },
    ];

    render(<ResultList trackNo={[mockTrackNo[0]]} results={mockResults} />);

    expect(screen.getByText(/EXPRESS123/)).toBeInTheDocument();
  });

  it('does not render items with invalid data', () => {
    const mockResults = [
      {
        data: {
          hisList: [],
          wbInfo: {
            expressCode: '',
          },
        },
        msg: 'Success',
        result: true,
      },
    ];

    render(<ResultList trackNo={[mockTrackNo[0]]} results={mockResults} />);

    // Should not render the track number if there's no valid history
    expect(screen.queryByText(/TRACK001/)).not.toBeInTheDocument();
  });
});

