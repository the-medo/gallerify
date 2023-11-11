import React from 'react';
import { Heading } from '@radix-ui/themes';

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  return (
    <Heading
      mt="9"
      size="9"
      align="center"
      data-header={true}
      style={{ color: 'var(--accent-11)' }}
    >
      Gallerify
    </Heading>
  );
};

export default Header;
