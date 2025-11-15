import React from 'react';
import Hero from '../components/Hero';
import HostingPlansNew from '../components/HostingPlansNew';

const Home: React.FC = () => {
  return (
    <main>
      <Hero />
      <HostingPlansNew />
    </main>
  );
};

export default Home;