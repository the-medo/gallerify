import React from 'react';
import { Box } from '@radix-ui/themes';

interface BackgroundBlobProps {
  translateX: number;
  translateY: number;
}

const BackgroundBlob: React.FC<BackgroundBlobProps> = ({ translateX, translateY }) => {
  const test = 10;

  console.log(test);

  return (
    <Box position="fixed" left={'0'} top={'0'} right={'0'} bottom={'0'} style={{ zIndex: '-1' }}>
      <svg id="sw-js-blob-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sw-gradient" x1="0" x2="1" y1="1" y2="0">
            <stop id="stop1" style={{ stopColor: 'var(--accent-12)' }} offset="0%"></stop>
            <stop id="stop2" style={{ stopColor: 'var(--accent-1)' }} offset="100%"></stop>
          </linearGradient>
        </defs>
        <path
          fill="url(#sw-gradient)"
          d="M18.2,-28.2C25.2,-23.8,33.6,-21.5,36.5,-16.3C39.3,-11.2,36.7,-3.1,35,4.7C33.3,12.5,32.7,20.1,28.3,23.9C24,27.6,16,27.5,8.6,29.9C1.3,32.2,-5.5,37.1,-9.3,34.6C-13,32.1,-13.7,22.3,-15.7,15.9C-17.7,9.5,-20.9,6.5,-23.6,2.1C-26.2,-2.3,-28.2,-8,-28.3,-15.1C-28.4,-22.2,-26.7,-30.6,-21.7,-35.8C-16.7,-41.1,-8.4,-43.2,-1.4,-41.1C5.6,-39,11.2,-32.6,18.2,-28.2Z"
          width="100%"
          height="100%"
          transform={`translate(${translateX} ${translateY})`}
          strokeWidth="0"
          style={{ transition: 'all 0.3s ease 0s' }}
        ></path>
      </svg>
    </Box>
  );
};

export default BackgroundBlob;
