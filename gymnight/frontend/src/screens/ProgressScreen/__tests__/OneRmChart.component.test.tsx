/**
 * Component tests for OneRmChart — receives pre-computed geometry from
 * computeChartGeometry and renders the corresponding SVG elements (mocked).
 * Tests element counts, not pixels.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Circle, Path } from 'react-native-svg';
import { OneRmChart } from '../OneRmChart';

interface SvgElementInstance {
  props: { fill?: string; d: string };
}

describe('OneRmChart', () => {
  it('renders with an empty series without throwing', () => {
    const { getByTestId } = render(<OneRmChart series={[]} testID="chart" />);
    expect(getByTestId('chart')).toBeTruthy();
  });

  it('renders one Circle per data point', () => {
    const series = [
      { timestampMs: 1, value: 100 },
      { timestampMs: 2, value: 110 },
      { timestampMs: 3, value: 105 },
    ];
    const { UNSAFE_getAllByType } = render(<OneRmChart series={series} testID="chart" />);
    const circles = UNSAFE_getAllByType(Circle);
    expect(circles.length).toBe(3);
  });

  it('renders a single point with no line-segment ("L") in the stroked line path', () => {
    const { UNSAFE_getAllByType } = render(
      <OneRmChart series={[{ timestampMs: 1, value: 100 }]} testID="chart" />,
    );
    const paths = UNSAFE_getAllByType(Path);
    // The stroked line (fill="none") must have no "L" segment for a single point —
    // the filled area path is allowed to still close a shape and may contain "L".
    const linePaths = paths.filter((p: SvgElementInstance) => p.props.fill === 'none');
    expect(linePaths.every((p: SvgElementInstance) => !p.props.d.includes('L'))).toBe(true);
  });
});
