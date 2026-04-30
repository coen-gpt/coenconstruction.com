import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import ProjectTypes from '../components/landing/ProjectTypes';
import HowItWorks from '../components/landing/HowItWorks';
import BudgetCalculator from '../components/calculator/BudgetCalculator';
import Footer from '../components/landing/Footer';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <ProjectTypes />
      <HowItWorks />
      <BudgetCalculator />
      <Footer />
    </div>
  );
}