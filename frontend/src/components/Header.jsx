import React from 'react';
import TopNav from './TopNav';

/**
 * Header component proxying to TopNav for backward compatibility.
 */
export default function Header(props) {
  return <TopNav {...props} />;
}
