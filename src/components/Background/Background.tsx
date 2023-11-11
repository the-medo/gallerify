import React from 'react';
import BackgroundBlob from './BackgroundBlob.tsx';

interface BackgroundProps {}

const Background: React.FC<BackgroundProps> = () => {
  return (
    <>
      <BackgroundBlob translateX={0} translateY={0} />
      <BackgroundBlob translateX={100} translateY={20} />
    </>
  );
};

export default Background;
