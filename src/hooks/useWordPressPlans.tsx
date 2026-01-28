import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export interface WordPressPlan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  yearlyPrice: number;
  originalYearlyPrice?: number;
  features: string[];
  popular?: boolean;
  description: string;
  specs: {
    storage: string;
    email: string;
    databases: string;
    support: string;
  };
}

const defaultWPPlans: WordPressPlan[] = [
  {
    id: 'wp-start',
    name: 'WP Start',
    price: 60,
    originalPrice: 120,
    yearlyPrice: 54, // Roční sleva 10%
    originalYearlyPrice: 60,
    description: 'Optimalizováno pro základní WordPress weby',
    features: [
      '10 GB prostoru',
      'Bez e-mailu',
      '1 databáze',
      'CRON: 3 úlohy',
      'SSL certifikát zdarma',
      'Automatická instalace WordPress',
      'Automatické aktualizace WP'
    ],
    specs: {
      storage: '10 GB',
      email: 'Bez e-mailu',
      databases: '1 databáze',
      support: 'Email podpora'
    }
  },
  {
    id: 'wp-pro',
    name: 'WP Pro',
    price: 100,
    originalPrice: 200,
    yearlyPrice: 90, // Roční sleva 10%
    originalYearlyPrice: 100,
    description: 'Pro profesionální WordPress weby s maximálním výkonem',
    features: [
      '15 GB prostoru',
      'E-maily: 2 GB',
      '1 databáze',
      'CRON: 5 úloh',
      'SSL certifikát zdarma',
      'Automatické zálohy',
      'WP-CLI přístup',
      'Optimalizace výkonu',
      'Staging prostředí'
    ],
    specs: {
      storage: '15 GB',
      email: '2 GB e-mailů',
      databases: '1 databáze',
      support: 'Email & Chat podpora'
    },
    popular: true
  }
];

export const useWordPressPlans = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('wp-pro');
  const { t } = useLanguage();

  const plans = useMemo(() => {
    return defaultWPPlans.map(plan => ({
      ...plan,
      name: t(`wpPlans.${plan.id}.name`, plan.name),
      description: t(`wpPlans.${plan.id}.description`, plan.description),
      features: plan.features.map((_, index) =>
        t(`wpPlans.${plan.id}.feature${index + 1}`)
      )
    }));
  }, [t]);

  const selectedPlan = plans.find(plan => plan.id === selectedPlanId) || plans[1];

  const selectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  useEffect(() => {
    const handlePlanSelect = (event: CustomEvent) => {
      if (event.detail && event.detail.id) {
        setSelectedPlanId(event.detail.id);
      }
    };

    window.addEventListener('selectWPPlan', handlePlanSelect as EventListener);

    return () => {
      window.removeEventListener('selectWPPlan', handlePlanSelect as EventListener);
    };
  }, []);

  return {
    plans,
    selectedPlan,
    selectedPlanId,
    selectPlan
  };
};
