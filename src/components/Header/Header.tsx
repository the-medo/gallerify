import React from 'react';
import { Box, Heading } from '@radix-ui/themes';

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  return (
    <Box width="max-content" p={'8'}>
      <Heading data-header={true}>Gallerify</Heading>
    </Box>
  );
};

export default Header;
