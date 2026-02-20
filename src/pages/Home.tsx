import React from 'react';
import Hero from '../components/Hero';
import HostingPlansNew from '../components/HostingPlansNew';
import PageMeta from '../components/PageMeta';

const Home: React.FC = () => {
  return (
    <main>
      <PageMeta
        title="Alatyr Hosting – Webhosting, domény a serverová řešení"
        description="Alatyr Hosting – profesionální webhosting, domény a serverová řešení. SSL zdarma, podpora 24/7, HestiaCP panel. Vyberte si hosting nebo doménu."
        path="/"
      />
      <Hero />
      <HostingPlansNew />
    </main>
  );
};

export default Home;