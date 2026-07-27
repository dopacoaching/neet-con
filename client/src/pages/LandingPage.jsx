import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';
import HeroSection from '../components/landing/HeroSection.jsx';
import AboutSection from '../components/landing/AboutSection.jsx';
import BenefitsSection from '../components/landing/BenefitsSection.jsx';
import RegistrationCTA from '../components/landing/RegistrationCTA.jsx';

const LandingPage = () => (
  <div>
    <Navbar />
    <main>
      <HeroSection />
      <AboutSection />
      <BenefitsSection />
      <RegistrationCTA />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
