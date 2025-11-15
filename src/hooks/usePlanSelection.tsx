import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export interface HostingPlan {
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
    websites: string;
    bandwidth: string;
    support: string;
  };
}

const defaultPlans: HostingPlan[] = [
  // WEBHOSTING PLÁNY
  {
    id: 'basic',
    name: 'Basic',
    price: 25,
    originalPrice: 50,
    yearlyPrice: 22.5, // Roční sleva 10%
    originalYearlyPrice: 25,
    description: 'Ideální pro malé osobní weby a začátečníky',
    features: [
      '5 GB prostoru',
      'SSL certifikát zdarma',
      'E-maily: 1 GB (1 mailbox)',
      'CRON: max 3 úlohy',
      '1 databáze (1 GB)',
      'Aliases: 0',
      'Subdomény: 1'
    ],
    specs: {
      storage: '5 GB',
      websites: '1 doména',
      bandwidth: 'Neomezený',
      support: 'Email podpora'
    }
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 40,
    originalPrice: 80,
    yearlyPrice: 36, // Roční sleva 10%
    originalYearlyPrice: 40,
    description: 'Pro malé podnikatele a rozšiřující se weby',
    features: [
      '10 GB prostoru',
      'SSL certifikát zdarma',
      'E-maily: 5 GB (5 mailboxů)',
      'CRON: max 4 úlohy',
      '2 databáze (2 GB)',
      'Aliases: 3',
      'Subdomény: 3'
    ],
    specs: {
      storage: '10 GB',
      websites: '1 doména',
      bandwidth: 'Neomezený',
      support: 'Email podpora'
    },
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 80,
    originalPrice: 160,
    yearlyPrice: 72, // Roční sleva 10%
    originalYearlyPrice: 80,
    description: 'Pro středně velké projekty s vyšší návštěvností',
    features: [
      '15 GB prostoru',
      'SSL certifikát zdarma',
      'E-maily: 10 GB (10 mailboxů)',
      'CRON: max 6 úloh',
      '5 databází (5 GB)',
      'Aliases: 5',
      'Subdomény: 5'
    ],
    specs: {
      storage: '15 GB',
      websites: '1 doména',
      bandwidth: 'Neomezený',
      support: 'Email & Chat podpora'
    }
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: 200,
    originalPrice: 400,
    yearlyPrice: 180, // Roční sleva 10%
    originalYearlyPrice: 200,
    description: 'Pro velké weby s maximálním výkonem a funkcemi',
    features: [
      '25 GB prostoru',
      'SSL certifikát zdarma',
      'E-maily: Neomezeně',
      'CRON: max 10 úloh',
      'Databáze: Neomezeně (10 GB celkem)',
      'Aliases: Neomezeně',
      'Subdomény: Neomezeně'
    ],
    specs: {
      storage: '25 GB',
      websites: '1 doména',
      bandwidth: 'Neomezený',
      support: '24/7 Prioritní podpora'
    }
  }
];

export const usePlanSelection = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('standard');
  const { t } = useLanguage();

  const plans = useMemo(() => {
    return defaultPlans.map(plan => ({
      ...plan,
      name: t(`plans.${plan.id}.name`),
      description: t(`plans.${plan.id}.description`)
    }));
  }, [t]);

  const selectedPlan = plans.find(plan => plan.id === selectedPlanId) || plans[1];

  const selectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  // Listen for custom plan selection events from HostingPlans component
  useEffect(() => {
    const handlePlanSelect = (event: CustomEvent) => {
      if (event.detail && event.detail.id) {
        setSelectedPlanId(event.detail.id);
      }
    };

    window.addEventListener('selectPlan', handlePlanSelect as EventListener);

    return () => {
      window.removeEventListener('selectPlan', handlePlanSelect as EventListener);
    };
  }, []);

  return {
    plans,
    selectedPlan,
    selectedPlanId,
    selectPlan
  };
};